const Invoice = require("../model/invoice");
const Guest = require("../model/guest");
const Room = require("../model/room");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const s3 = require("../config/S3.js");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const sendInvoiceEmail = async (
  pdfBuffer,
  invoiceNumber,
  guestName,
  roomNumber
) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const friendlyFilename = `Invoice - ${guestName.replace(
    / /g,
    "_"
  )} - Room_${roomNumber} - ${invoiceNumber}.pdf`;

  const mailOptions = {
    from: `"HSQ Towers" <${process.env.EMAIL_USER}>`,
    to: process.env.OFFICE_EMAIL,
    subject: `Invoice Archived: ${invoiceNumber} (Guest: ${guestName}, Room: ${roomNumber})`,
    text: `An invoice has been generated and archived for guest: ${guestName} in Room ${roomNumber}.\n\nInvoice Number: ${invoiceNumber}`,
    attachments: [
      {
        filename: friendlyFilename,
        content: pdfBuffer,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};


const generatePdfFromHtml = async (htmlContent) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();
  return pdfBuffer;
};

const uploadInvoiceS3 = async (pdfBuffer, invoiceNumber) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: `invoices/${invoiceNumber}.pdf`,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  };
  await s3.send(new PutObjectCommand(params));

  return `invoices/${invoiceNumber}.pdf`;
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: "guest",
        populate: { path: "room", model: "Room" }, // <-- Deep populate is better here too
      })
      .populate("createdBy", "name");

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }
    res.status(200).json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.sendInvoiceByEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id).populate({
      path: "guest",
      populate: { path: "room", model: "Room" },
    });

    if (!invoice || !invoice.guest || !invoice.guest.room) {
      return res.status(404).json({
        success: false,
        message: "Invoice, associated guest, or room data not found.",
      });
    }

    // 1. Render EJS -> HTML
    const templatePath = path.resolve(
      __dirname,
      "..",
      "views",
      "invoice-template.ejs"
    );
    const htmlContent = await ejs.renderFile(templatePath, {
      invoice,
      guest: invoice.guest,
    });

    //  Generate PDF Buffer
    const pdfBuffer = await generatePdfFromHtml(htmlContent);
    console.log("Invoice ganerated");
    //  Upload to S3
    const s3Key = await uploadInvoiceS3(pdfBuffer, invoice.invoiceNumber);

    // Save S3 path in DB
    invoice.pdfPath = s3Key;
    await invoice.save();
    // console.log("INVOICE SEND TO S3");
    //  Send Email with PDF buffer
    await sendInvoiceEmail(
      pdfBuffer,
      invoice.invoiceNumber,
      invoice.guest.fullName,
      invoice.guest.room.roomNumber
    );

    res.status(200).json({
      success: true,
      message: "Invoice PDF uploaded to S3 and sent via email!",
      s3Path: s3Key,
    });
  } catch (err) {
    console.error("sendInvoiceByEmail Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to process and send invoice",
      error: err.message,
    });
  }
};

exports.searchInvoices = async (req, res) => {
  try {
    const { guestName, roomNumber, invoiceNumber } = req.query;

    let guestIds = [];
    if (guestName || roomNumber) {
      const guestQuery = {};
      if (guestName) {
        guestQuery.fullName = new RegExp(guestName, "i");
      }

      if (roomNumber) {
        // <-- BUG FIX: Changed 'room.findOne' to 'Room.findOne' (capital R)
        const room = await Room.findOne({ roomNumber: roomNumber });
        if (room) {
          guestQuery.room = room._id;
        } else {
          return res.status(200).json({ success: true, count: 0, data: [] });
        }
      }
      const matchingGuests = await Guest.find(guestQuery).select("_id");
      guestIds = matchingGuests.map((guest) => guest._id);
    }

    const invoiceQuery = {};
    if (guestIds.length > 0) {
      invoiceQuery.guest = { $in: guestIds };
    }
    if (invoiceNumber) {
      invoiceQuery.invoiceNumber = new RegExp(invoiceNumber, "i");
    }

    if (Object.keys(invoiceQuery).length === 0 && !guestName && !roomNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide at least one search term (guestName, roomNumber, or invoiceNumber).",
      });
    }

    if ((guestName || roomNumber) && guestIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate({
        path: "guest",
        populate: { path: "room", model: "Room" },
      })
      .sort({ createdAt: -1 })
      .limit(50);

    res
      .status(200)
      .json({ success: true, count: invoices.length, data: invoices });
  } catch (err) {
    console.error("searchInvoices Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during search",
      error: err.message,
    });
  }
};

exports.getAllInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    const invoices = await Invoice.find()
      .populate({
        path: "guest",
        select: "fullName room",
        populate: { path: "room", model: "Room", select: "roomNumber" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalInvoices = await Invoice.countDocuments();

    res.status(200).json({
      success: true,
      count: invoices.length,
      totalPages: Math.ceil(totalInvoices / limit),
      currentPage: page,
      data: invoices,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !["pending", "paid", "cancelled"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status provided." });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status: status },
      { new: true, runValidators: true } // 'new: true' returns the updated document
    );

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    res.status(200).json({
      success: true,
      message: `Invoice status updated to ${status}`,
      data: invoice,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    res.status(200).json({
      success: true,
      message: "Invoice and associated PDF deleted successfully.",
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate({
      path: "guest",
      populate: { path: "room", model: "Room" },
    });

    if (!invoice || !invoice.pdfPath) {
      return res.status(404).json({
        success: false,
        message: "Invoice or its PDF file not found.",
      });
    }

    const friendlyFilename = `Invoice - ${invoice.guest.fullName.replace(
      / /g,
      "_"
    )} - Room_${invoice.guest.room.roomNumber} - ${invoice.invoiceNumber}.pdf`;

    // Generate signed URL for S3 object
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: invoice.pdfPath,
      ResponseContentDisposition: `attachment; filename="${friendlyFilename}"`,
    });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    res.json({
      success: true,
      url: signedUrl,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
