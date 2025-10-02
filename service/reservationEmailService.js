const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendReservationConfirmation = async (
  reservationDetails,
  roomDetails
) => {
  const options = { year: "numeric", month: "long", day: "numeric" };
  const checkInDate = new Date(reservationDetails.startAt);
  const checkOutDate = new Date(reservationDetails.endAt);

  const checkIn = checkInDate.toLocaleDateString("en-US", options);
  const checkOut = checkOutDate.toLocaleDateString("en-US", options);

  // --- START OF NEW CALCULATIONS ---
  // Calculate the difference in milliseconds
  const timeDifference = checkOutDate.getTime() - checkInDate.getTime();

  // Convert milliseconds to days to get the number of nights
  const numberOfNights = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

  // Calculate the total rent
  const totalRent = roomDetails.rate * numberOfNights;

  // Format numbers with commas for better readability
  const formattedRate = roomDetails.rate.toLocaleString("en-IN");
  const formattedTotalRent = totalRent.toLocaleString("en-IN");
  // --- END OF NEW CALCULATIONS ---

  const mailOptions = {
    from: `"HSQ Towers Reservations" <${process.env.EMAIL_USER}>`,
    to: reservationDetails.email,
    subject: `Your Reservation at HSQ Towers is Confirmed!`,
    html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #c09a58;">Reservation Confirmation</h2>
                    <p>Dear ${reservationDetails.fullName},</p>
                    <p>Thank you for choosing HSQ Towers. Your booking is confirmed, and we are excited to welcome you.</p>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <h3 style="color: #333;">Booking Details:</h3>
                    <ul style="list-style-type: none; padding: 0;">
                        <li style="margin-bottom: 10px;"><strong>Room:</strong> ${roomDetails.roomNumber} - ${roomDetails.bedType} - with ${roomDetails?.view || "no view"} </li>
                        <li style="margin-bottom: 10px;"><strong>Check-in:</strong> ${checkIn}</li>
                        <li style="margin-bottom: 10px;"><strong>Check-out:</strong> ${checkOut}</li>
                        <li style="margin-bottom: 10px;"><strong>Number of Nights:</strong> ${numberOfNights}</li>
                        ${
                          reservationDetails.expectedArrivalTime
                            ? `<li style="margin-bottom: 10px;"><strong>Expected Arrival:</strong> ${reservationDetails.expectedArrivalTime}</li>`
                            : ""
                        }
                    </ul>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <h3 style="color: #333;">Price Summary:</h3>
                     <ul style="list-style-type: none; padding: 0;">
                        <li style="margin-bottom: 10px;"><strong>Rate per Night:</strong> Rs. ${formattedRate}/-</li>
                        <li style="margin-bottom: 10px;"><strong>Total Room Rent:</strong> Rs. ${formattedTotalRent}/-</li>
                        <li style="margin-bottom: 5px;"><small>Taxes and other fees will be calculated at check-in.</small></li>
                    </ul>
                    <p>If you have any special requests, please don't hesitate to contact us on WhatsApp at <a href="https://wa.me/${
                      process.env.HOTEL_WHATSAPP_NUMBER
                    }" style="color: #25D366; font-weight: bold;">Contact Us</a>.</p>
                    <p>We look forward to your arrival!</p>
                    <br>
                    <p>Sincerely,</p>
                    <p><strong>The HSQ Towers Team</strong></p>
                </div>
            </div>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(
      "Guest confirmation email sent successfully to:",
      reservationDetails.email
    );
    return true;
  } catch (error) {
    console.error("Error sending guest confirmation email:", error);
    return false;
  }
};
