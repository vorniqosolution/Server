const Invoice = require('../model/invoice');
const Guest = require('../model/guest');
const Setting = require('../model/Setting');

/**
 * Calculate free mattresses based on room category and bed type.
 * 
 * SOP (Standard Operating Procedure):
 * - Presidential: One Bed = 1 free, Two Bed = 2 free
 * - Duluxe-Plus:  One Bed = 1 free, Two Bed = 2 free
 * - Deluxe:       One Bed = 1 free, Two Bed = 2 free
 * - Executive:    One Bed = 1 free, Two Bed = 2 free
 * - Standard:     Studio = 0 free (all charged)
 * 
 * @param {string} category - Room category
 * @param {string} bedType - Bed type ("Two Bed", "One Bed", "Studio")
 * @returns {number} Number of free mattresses
 */
function getFreeMattresses(category, bedType) {
    const isTwoBed = bedType === "Two Bed";
    switch (category) {
        case "Presidential":
        case "Duluxe-Plus":
        case "Deluxe":
        case "Executive":
            return isTwoBed ? 2 : 1;
        case "Standard":
        default:
            return 0;
    }
}

function recalculateInvoiceTotals(invoice) {
    if (!invoice) return null;

    // Calculate subtotal from all items (GROSS amount)
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.total || 0), 0);
    invoice.subtotal = subtotal;

    // Calculate total discounts
    const standardDiscount = invoice.discountAmount || 0;
    const additionalDiscount = invoice.additionaldiscount || 0;
    const totalDiscounts = standardDiscount + additionalDiscount;

    // Calculate subtotal after discounts
    const subtotalAfterDiscounts = Math.max(0, subtotal - totalDiscounts);

    // Calculate tax on post-discount amount
    const taxRate = invoice.taxRate || 0;
    invoice.taxAmount = Math.round(subtotalAfterDiscounts * (taxRate / 100));

    // Calculate grand total
    invoice.grandTotal = subtotalAfterDiscounts + invoice.taxAmount;

    // Calculate balance due (considering advance payments)
    const advanceAdjusted = invoice.advanceAdjusted || 0;
    invoice.balanceDue = Math.max(0, invoice.grandTotal - advanceAdjusted);

    // Update status
    invoice.status = invoice.balanceDue === 0 ? "paid" : "pending";

    return invoice;
}

async function updateMattressCharges(guestId, newMattressCount, room) {
    try {
        // Find the invoice for this guest
        const invoice = await Invoice.findOne({ guest: guestId });
        if (!invoice) {
            return { success: true, message: "No invoice found for guest, skipping update" };
        }

        // Get settings for mattress rate
        const settings = await Setting.findById("global_settings").lean();
        const mattressRate = Number(settings?.mattressRate ?? 1500);

        // Calculate chargeable mattresses
        const freeMattresses = getFreeMattresses(room.category, room.bedType);
        const chargeableMattresses = Math.max(0, newMattressCount - freeMattresses);
        const newMattressTotal = chargeableMattresses * mattressRate;

        // Find existing mattress item in invoice
        const mattressItemIndex = invoice.items.findIndex(item =>
            item.description && item.description.toLowerCase().includes('mattress')
        );

        if (chargeableMattresses > 0) {
            // Add or update mattress line item
            const mattressItem = {
                description: "Extra Mattresses",
                quantity: chargeableMattresses,
                unitPrice: mattressRate,
                total: newMattressTotal
            };

            if (mattressItemIndex >= 0) {
                // Update existing item
                invoice.items[mattressItemIndex] = mattressItem;
            } else {
                // Add new item (insert after room rent, typically index 1)
                const insertIndex = Math.min(1, invoice.items.length);
                invoice.items.splice(insertIndex, 0, mattressItem);
            }
        } else {
            // Remove mattress item if exists (no chargeable mattresses)
            if (mattressItemIndex >= 0) {
                invoice.items.splice(mattressItemIndex, 1);
            }
        }

        // Recalculate totals
        recalculateInvoiceTotals(invoice);

        // Save the invoice
        await invoice.save();

        return {
            success: true,
            invoice: invoice,
            message: chargeableMattresses > 0
                ? `Mattress charges updated: ${chargeableMattresses} @ Rs ${mattressRate}`
                : "Mattress charges removed"
        };
    } catch (error) {
        console.error("updateMattressCharges Error:", error);
        return {
            success: false,
            message: error.message
        };
    }
}

module.exports = {
    getFreeMattresses,
    recalculateInvoiceTotals,
    updateMattressCharges
};
