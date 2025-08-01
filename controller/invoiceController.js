// --- Required imports ---
const Invoice = require("../model/invoice");
const Guest = require("../model/guest");
const Room = require("../model/room");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const ejs = require("ejs");


const sendInvoiceEmail = async (filePath, invoiceNumber, guestName, roomNumber) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // <-- CHANGE: Create a more descriptive, human-friendly filename -->
  const friendlyFilename = `Invoice - ${guestName.replace(/ /g, '_')} - Room_${roomNumber} - ${invoiceNumber}.pdf`;

  const mailOptions = {
    from: `"HSQ Towers" <${process.env.EMAIL_USER}>`, // <-- Updated sender name
    to: "hsqtower@gmail.com",
    subject: `Invoice Archived: ${invoiceNumber} (Guest: ${guestName}, Room: ${roomNumber})`, // <-- Updated subject
    text: `An invoice has been generated and archived for guest: ${guestName} in Room ${roomNumber}.\n\nInvoice Number: ${invoiceNumber}`, // <-- Updated body
    attachments: [
      {
        filename: friendlyFilename, // <-- Use the new friendly filename
        path: filePath,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};

const generatePdfFromHtml = async (htmlContent) => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdfBuffer;
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: "guest",
        populate: { path: 'room', model: 'Room' } // <-- Deep populate is better here too
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
    
    // The deep populate is essential for getting the room number
    const invoice = await Invoice.findById(id).populate({
      path: 'guest',
      populate: {
        path: 'room',
        model: 'Room'
      }
    });

    // <-- CHANGE: Added a more robust check for guest and room data -->
    if (!invoice || !invoice.guest || !invoice.guest.room) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice, associated guest, or room data not found." });
    }

    // 1. Render the EJS template to create the HTML content
    const templatePath = path.resolve(__dirname, '..', 'views', 'invoice-template.ejs');
    const htmlContent = await ejs.renderFile(templatePath, {
        invoice: invoice,
        guest: invoice.guest
    });

    // 2. Generate PDF from HTML
    const pdfBuffer = await generatePdfFromHtml(htmlContent);

    // 3. Ensure the target directory exists
    const invoicesDir = path.join(__dirname, "..", "uploads", "invoices");
    fs.mkdirSync(invoicesDir, { recursive: true });

    // 4. Define the unique filename for saving on the server
    const serverFilename = `invoice-${invoice.invoiceNumber}.pdf`;
    const savePath = path.join(invoicesDir, serverFilename);

    // 5. Save the PDF to the disk
    fs.writeFileSync(savePath, pdfBuffer);
    
    // 6. Update the database with the server path
    invoice.pdfPath = `/uploads/invoices/${serverFilename}`;
    await invoice.save();

    // <-- CHANGE: Pass the guest name and room number to the email helper -->
    await sendInvoiceEmail(
        savePath, 
        invoice.invoiceNumber,
        invoice.guest.fullName,
        invoice.guest.room.roomNumber
    );

    res.status(200).json({
      success: true,
      message: "Invoice PDF saved and sent to internal records successfully!",
      filePath: invoice.pdfPath,
    });
  } catch (err) {
    console.error("sendInvoiceByEmail Error:", err);
    res
      .status(500)
      .json({
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
            guestQuery.fullName = new RegExp(guestName, 'i');
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
        const matchingGuests = await Guest.find(guestQuery).select('_id');
        guestIds = matchingGuests.map(guest => guest._id);
    }
    
    const invoiceQuery = {};
    if (guestIds.length > 0) {
      invoiceQuery.guest = { $in: guestIds };
    }
    if (invoiceNumber) {
      invoiceQuery.invoiceNumber = new RegExp(invoiceNumber, 'i');
    }

    if (Object.keys(invoiceQuery).length === 0 && !guestName && !roomNumber) {
        return res.status(400).json({ success: false, message: "Please provide at least one search term (guestName, roomNumber, or invoiceNumber)." });
    }
    
    if ((guestName || roomNumber) && guestIds.length === 0) {
        return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate({
          path: 'guest',
          populate: { path: 'room', model: 'Room' }
      })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, count: invoices.length, data: invoices });

  } catch (err) {
    console.error("searchInvoices Error:", err);
    res.status(500).json({ success: false, message: "Server error during search", error: err.message });
  }
};

exports.getAllInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    const invoices = await Invoice.find()
      .populate({
          path: 'guest',
          select: 'fullName room',
          populate: { path: 'room', model: 'Room', select: 'roomNumber' }
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
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['pending', 'paid', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status provided." });
    }

    const invoice = await Invoice.findByIdAndUpdate(
        req.params.id,
        { status: status },
        { new: true, runValidators: true } // 'new: true' returns the updated document
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    res.status(200).json({ success: true, message: `Invoice status updated to ${status}`, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // Optional: Delete the associated PDF file from the server
    if (invoice.pdfPath) {
        const fullPath = path.join(__dirname, '..', invoice.pdfPath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }

    res.status(200).json({ success: true, message: "Invoice and associated PDF deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.downloadInvoicePdf = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate({
            path: 'guest',
            populate: { path: 'room', model: 'Room' }
        });

        if (!invoice || !invoice.pdfPath) {
            return res.status(404).json({ success: false, message: "Invoice or its PDF file not found." });
        }

        const fullPath = path.join(__dirname, '..', invoice.pdfPath);
        
        if (!fs.existsSync(fullPath)) {
             return res.status(404).json({ success: false, message: "PDF file is missing from the server." });
        }
        
        // Create the human-friendly filename for download
        const friendlyFilename = `Invoice - ${invoice.guest.fullName.replace(/ /g, '_')} - Room_${invoice.guest.room.roomNumber} - ${invoice.invoiceNumber}.pdf`;

        // Use res.download() to send the file to the client
        res.download(fullPath, friendlyFilename);

    } catch (err) {
         res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
}