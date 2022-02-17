/**
 *  Incoming WA message webhook
 *
 *  Pre-requisites:
 *  - Enable ACCOUNT_SID and AUTH_TOKEN in your functions configuration (https://www.twilio.com/console/functions/configure)
 *  - Add STRIPE_SECRET_KEY to your environment variables (https://www.twilio.com/console/functions/configure)
 *  - Add stripe to your NPM package dependencies (https://www.twilio.com/console/functions/configure)
 */

const Stripe = require('stripe');

/*
 * Format the amount for usage with Stripe.
 * Detect and handle zero-decimal currencies.
 * (Stripe requires integers for monetary amounts, so £9.99 is sent as GBP999)
 */
const formatAmountForStripe = ({ amount, currency }) => {
    // eslint-disable-next-line radix
    amount = parseInt(amount);
    const numberFormat = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency,
	currencyDisplay: 'symbol',
    });
    
    const parts = numberFormat.formatToParts(amount);
    let zeroDecimalCurrency = true;
    for (const part of parts) {
	if (part.type === 'decimal') {
	    zeroDecimalCurrency = false;
	}
    }
    amount = zeroDecimalCurrency ? amount : amount * 100;
    return amount;
};


/**
 *  Add other currencies you wish to support here
 *  (note that the other function contains a reverse mapping, too)
 */
const currencies =  {
    '£': "GBP",
    '$': "USD",
    '€': "EUR"
}

const parseAmount = (value) => {
    
    const currency = value.substring(0,1);
    
    if  (currencies[currency]){
	return [value.substring(1), currencies[currency]];
	
    } else {
	// assume values without currency symbols are GBP
	return [value, 'GBP'];
    }
}

const createInvoice = async (stripeSecretKey, fromNumber, profileName, value) => {
    
    const [amount,currency] = parseAmount(value);
    
    const stripe = Stripe(stripeSecretKey);  // from environment variable
    
    // Create a customer object with their phone number.
    const customer = await stripe.customers.create({
        description: `${profileName} (WhatsApp customer via Twilio)`,
        name: profileName,
        phone: fromNumber.replace("whatsapp:", ""),
	// WhatsApp numbers are formatted by Twilio as "whatsapp:+44759xxxx"
	// Stripe requires us to remove the "whatsapp:" prefix.
    });
    
    // Create the invoice with the amount from the message body.
    await stripe.invoiceItems.create({
        customer: customer.id,
        amount: formatAmountForStripe({ amount, currency }),
        currency,
        description: `Donation of ${amount} ${currency}`,
    });
    
    // this creates a *draft* invoice with all the invoice
    // items that are associated with that customer (of which
    // there is only 1, created just above)
    const invoice = await stripe.invoices.create({
        customer: customer.id,
        auto_advance: false,
    });
    
    // "finalize" turns a *draft* invoice into a real one,
    // generating the invoice URL, pdf etc.
    const finalInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    
    return finalInvoice.hosted_invoice_url;
}

exports.handler = async function (context, event, callback) {
    const content = event.Body.split(' ');
    const action = content[0].toUpperCase();

    if (action === 'DONATE') {
	
        try{
            const amount = content[1];
            const invoiceUrl = await createInvoice(
		context.STRIPE_SECRET_KEY,
		event.From,
		event.ProfileName,
		amount);
	    
            let twiml = new Twilio.twiml.MessagingResponse();
            twiml.message(`Please use this link to make your donation ${invoiceUrl}`);
	    
            return callback(null, twiml);
	    
        } catch (error) {
            // Respond with error message
            console.log({ error });
            return callback(error);
        }
    } else {
        
        // If the message didn't start with "donate" then send back a message which
	// matches the template created in the Twilio console. This will automatically
	// add buttons for "Donate £5", "Donate £10" and "Donate £20"
        let twiml = new Twilio.twiml.MessagingResponse();
        twiml.message("Hello ❤ Thank you for your interest in donating to Twilio.org demo. How much would you like to donate?");
	
        return callback(null, twiml);
    }
};
