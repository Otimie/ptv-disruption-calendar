'use strict';

const crypto = require('crypto');
const https = require('https');

function signedPath(unsignedPath, userId = process.env.USER_ID, apiKey = process.env.API_KEY) {

	// Query string separator
	var path = unsignedPath + (unsignedPath.indexOf('?') > -1 ? '&' : '?');
	var raw = path + 'devid=' + userId;

	// Calculate signature
	var hashed = crypto.createHmac('sha1', apiKey).update(raw);
	var signature = hashed.digest('hex');

	// Append signature to the URL
	return raw + '&signature=' + signature;
}



exports.handler = (event, context, callback) => {

	https.get({
		host: 'timetableapi.ptv.vic.gov.au',
		path: signedPath('/v3/disruptions/route/2')
	}, function (response) {

		var body = '';

		response.on('data', function (data) {
			body += data;
		});

		response.on('end', function () {

			if (response.statusCode === 200) {

				var parsedBody = JSON.parse(body);

				if (parsedBody.status.health === 1 && parsedBody.status.version === '3.0') {

					process.stdout.write('BEGIN:VCALENDAR\r\n');
					process.stdout.write('VERSION:2.0\r\n');
					process.stdout.write('X-WR-CALNAME:Disruptions: Belgrave\r\n');
					process.stdout.write('PRODID:-//hacksw/handcal//NONSGML v1.0//EN\r\n');

					parsedBody.disruptions.metro_train.forEach(function (element) {

						process.stdout.write('BEGIN:VEVENT\r\n');
						process.stdout.write('SUMMARY:' + element.title + '\r\n');
						process.stdout.write('UID:' + element.disruption_id + '\r\n');
						process.stdout.write('DTSTART:' + element.from_date.replace(/[-:]/g,'') + '\r\n');
						process.stdout.write('DTEND:' + element.to_date.replace(/[-:]/g,'') + '\r\n');
						process.stdout.write('DESCRIPTION:' + element.description + '\r\n');
						process.stdout.write('END:VEVENT' + '\r\n');

					});

					process.stdout.write('END:VCALENDAR');
					callback(null, '');
				}
			}

		});

	});

};
