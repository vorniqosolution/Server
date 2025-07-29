// --- Required imports ---
const Invoice = require("../model/invoice");
const Guest = require("../model/guest");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const ejs = require("ejs");


const sendInvoiceEmail = async (filePath, invoiceNumber) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Your Hotel Name" <${process.env.EMAIL_USER}>`,
    to: "hsqtower@gmail.com",
    subject: `Invoice Archived: ${invoiceNumber}`,
    text: `A new invoice has been generated and archived on the server.\n\nInvoice Number: ${invoiceNumber}`,
    attachments: [
      {
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
        select: "fullName email phone address checkInAt checkOutAt",
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
    
    // We need to populate the 'room' field within the 'guest' document
    const invoice = await Invoice.findById(id).populate({
      path: 'guest',
      populate: {
        path: 'room',
        model: 'Room'
      }
    });

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    // --- THIS IS THE ONLY CHANGE YOU NEED TO MAKE ---
    // 1. Render the EJS template file to create the HTML content
    const templatePath = path.resolve(__dirname, '..', 'views', 'invoice-template.ejs');
    const htmlContent = await ejs.renderFile(templatePath, {
        invoice: invoice,
        guest: invoice.guest
    });
    // --- END OF CHANGE ---

    // 2. Generate PDF from HTML. This now uses the beautiful template.
    const pdfBuffer = await generatePdfFromHtml(htmlContent);

    // 3. Define the directory path and ensure it exists
    const invoicesDir = path.join(__dirname, "..", "uploads", "invoices");
    fs.mkdirSync(invoicesDir, { recursive: true });

    // 4. Define the full save path for the file
    const filename = `invoice-${invoice.invoiceNumber}.pdf`;
    const savePath = path.join(invoicesDir, filename);

    // 5. Save the PDF buffer to the disk
    fs.writeFileSync(savePath, pdfBuffer);
    
    // ... (the rest of the function remains the same)
    
    invoice.pdfPath = `/uploads/invoices/${filename}`;
    await invoice.save();

    await sendInvoiceEmail(savePath, invoice.invoiceNumber);

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
    // Get search terms from the URL query string
    // e.g., /api/invoices/search?guestName=john&roomNumber=101
    const { guestName, roomNumber, invoiceNumber } = req.query;

    // --- Part 1: Find matching guests if name or room is provided ---
    let guestIds = [];
    if (guestName || roomNumber) {
        const guestQuery = {};
        if (guestName) {
            // Use a case-insensitive regex for partial name matching
            guestQuery.fullName = new RegExp(guestName, 'i');
        }

        if (roomNumber) {
            // Find the room's ID first
            const room = await room.findOne({ roomNumber: roomNumber });
            if (room) {
                guestQuery.room = room._id;
            } else {
                // If the room doesn't exist, no results are possible
                return res.status(200).json({ success: true, count: 0, data: [] });
            }
        }
        // Get the IDs of all guests that match our criteria
        const matchingGuests = await Guest.find(guestQuery).select('_id');
        guestIds = matchingGuests.map(guest => guest._id);
    }
    
    // --- Part 2: Build the final query for the Invoices collection ---
    const invoiceQuery = {};

    // If we have guest IDs from the search, add them to the invoice query
    if (guestIds.length > 0) {
      invoiceQuery.guest = { $in: guestIds };
    }

    // Add invoice number search term directly to the invoice query
    if (invoiceNumber) {
      invoiceQuery.invoiceNumber = new RegExp(invoiceNumber, 'i');
    }

    // --- Safety Check ---
    // If no search terms were provided at all, return an error.
    // This prevents accidentally fetching every invoice in the database.
    if (Object.keys(invoiceQuery).length === 0 && !guestName && !roomNumber) {
        return res.status(400).json({ success: false, message: "Please provide at least one search term (guestName, roomNumber, or invoiceNumber)." });
    }
    
    // If a guest search was performed but yielded no results, we can stop early
    if ((guestName || roomNumber) && guestIds.length === 0) {
        return res.status(200).json({ success: true, count: 0, data: [] });
    }

    // --- Part 3: Execute the final search ---
    const invoices = await Invoice.find(invoiceQuery)
      .populate({
          path: 'guest',
          populate: { path: 'room', model: 'Room' } // Deep populate to get room details
      })
      .sort({ createdAt: -1 }) // Show the most recent invoices first
      .limit(50); // Limit results to prevent overwhelming the frontend

    res.status(200).json({ success: true, count: invoices.length, data: invoices });

  } catch (err) {
    console.error("searchInvoices Error:", err);
    res.status(500).json({ success: false, message: "Server error during search", error: err.message });
  }
};