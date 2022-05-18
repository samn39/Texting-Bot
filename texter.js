require('dotenv').config();
const client = require('twilio')(process.env.ACCOUNTSID, process.env.AUTHTOKEN);

const Texter = {
	sendMsg: (number, msg) => {
		client.messages.create({
			body: msg,
			from: "+15732502162",
			to: number
		})
		.then((messsage) => console.log(message.sid));
	}
}

module.exports = Texter;
