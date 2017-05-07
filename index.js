'use strict';

const crypto = require('crypto');

function signApiRequest(pathname, userId = 1234567, apiKey = '00000000-0000-0000-0000-000000000000', domain = 'https://timetableapi.ptv.vic.gov.au') {

	// Query string separator
	pathname = pathname + (pathname.indexOf('?') ? '?' : '&');
	var raw = pathname + 'devid=' + userId.toString();

	// Calculate signature
	var hashed = crypto.createHmac('sha1', apiKey).update(raw);
	var signature = hashed.digest('hex');

	// Append signature to the URL
	return domain + raw + '&signature=' + signature;
}

// Print signed URL to standard output
console.log(signApiRequest('/v3/disruptions'));