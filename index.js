'use strict';

const crypto = require('crypto');
const https = require('https');

function signedPath(unsignedPath, userId = process.env.USER_ID, apiKey = process.env.API_KEY) {

	// Query string separator
	var path = unsignedPath + (unsignedPath.indexOf('?') > -1 ? '&' : '?');
	var raw = path + 'devid=' + userId.toString();

	// Calculate signature
	var hashed = crypto.createHmac('sha1', apiKey).update(raw);
	var signature = hashed.digest('hex');

	// Append signature to the URL
	return raw + '&signature=' + signature;
}

https.get({
	host: 'timetableapi.ptv.vic.gov.au',
	path: signedPath('/v3/disruptions/route/9?disruption_status=planned')
}, function (response) {

	var body = '';

	response.on('data', function (data) {
		body += data;
	});

	response.on('end', function () {

		if (response.statusCode === 200) {

			var parsedBody = JSON.parse(body);

			if (parsedBody.status.health === 1 && parsedBody.status.version === '3.0') {
				console.log(parsedBody.disruptions);
			}
		}

	});

});
