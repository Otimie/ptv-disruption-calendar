'use strict';

const crypto = require('crypto');
const https = require('https');

const AWS = require('aws-sdk');

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
					
					var calendarBody = 'BEGIN:VCALENDAR\r\n';
					calendarBody += 'VERSION:2.0\r\n';
					calendarBody += 'X-WR-CALNAME:Disruptions: Belgrave\r\n');
					calendarBody += 'PRODID:-//hacksw/handcal//NONSGML v1.0//EN\r\n');

					parsedBody.disruptions.metro_train.forEach(function (element) {

						calendarBody += 'BEGIN:VEVENT\r\n';
						calendarBody += 'SUMMARY:' + element.title + '\r\n';
						calendarBody += 'UID:' + element.disruption_id + '\r\n';
						calendarBody += 'DTSTART:' + element.from_date.replace(/[-:]/g,'') + '\r\n';
						calendarBody += 'DTEND:' + element.to_date.replace(/[-:]/g,'') + '\r\n';
						calendarBody += 'DESCRIPTION:' + element.description + '\r\n';
						calendarBody += 'END:VEVENT' + '\r\n';

					});

					calendarBody += 'END:VCALENDAR';
					
					var s3 = new AWS.S3({apiVersion: '2006-03-01'});
					
					var params = {
						Bucket: 'ptv-calendar-disruptions',
						Key: '2',
						Body: calendarBody
					};
					
					s3.putObject(params, function(error, data) {
						if (error) {
							console.log(error, error.stack);
						}
						else {
							console.log(data);
							callback(null, 'Success');
						}
					});
				}
			}
		});
	});
};
