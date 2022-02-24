/**
 * This function is *public* and is called by a Stripe webhook configured to react
 * to `invoice.paid` events
 */

const Stripe = require('stripe');

 const currencies =  {
   "GBP": '£',
   "USD": '$',
   "EUR": '€'
 }

exports.handler = async function(context, event, callback) {

  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.setStatusCode(200);

   if (event.type === 'invoice.paid') {
     const stripe = Stripe(context.STRIPE_SECRET_KEY);
     const stripeEvent = await stripe.events.retrieve(event.id);

     const invoice = await stripe.invoices.retrieve(stripeEvent.data.object.id);

     const customerName = invoice.customer_name || '';
     const donationAmount = currencies[invoice.currency.toUpperCase()] + invoice.total / 100;

     // When we created the invoice we set the phone number
     // but we need to add prefix of "whatsapp:"
     // Note: this message will not be sent unless the invoice is paid within 24 hours,
     //       as the WhatsApp session will have expired. (https://www.twilio.com/docs/whatsapp/key-concepts#the-24-hour-window-or-24-hour-session)
     if (invoice.customer_phone){
        const client = context.getTwilioClient();
        const message = await client.messages.create({
          to: "whatsapp:" + invoice.customer_phone,
          from: "whatsapp:" + context.TWILIO_PHONE_NUMBER,
          body: `Thank you ${customerName}  ❤️ To find out how your ${donationAmount} has helped, please visit https://twilio.org `
        });
     }

   }

  return callback(null, response);
};
