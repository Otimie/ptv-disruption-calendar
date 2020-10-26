'use strict';

const https = require('https');

const AWS = require('aws-sdk');

const s3 = new AWS.S3({apiVersion: '2006-03-01'});

/**
 * @param   {Object} Disruption
 * @returns {String} iCal formatted calendar entry
 */
function toICal(disruption) {
	// TODO: Wrap lines that are too long as per the specification
	var calendarBody = 'BEGIN:VCALENDAR\r\n';
	calendarBody += 'VERSION:2.0\r\n';
	calendarBody += 'X-WR-CALNAME:Disruptions: ' + (disruption.route_number ? disruption.route_number + ' - ': '') + disruption.route_name + '\r\n';

	// TODO: Update `PRODID`
	calendarBody += 'PRODID:-//ABC Corporation//NONSGML My Product//EN\r\n';

	disruption.disruptions.forEach((element) => {
		calendarBody += 'BEGIN:VEVENT\r\n';
		calendarBody += 'SUMMARY:' + element.title + '\r\n';
		calendarBody += 'UID:' + element.disruption_id + '\r\n';
		calendarBody += 'DTSTART:' + element.from_date.replace(/[-:]/g,'') + '\r\n';

		// Disruptions might not always have a to_date, i.e. Current disruptions
		if (element.to_date) {
			calendarBody += 'DTEND:' + element.to_date.replace(/[-:]/g, '') + '\r\n';
		}

		calendarBody += 'DESCRIPTION:' + element.description + '\r\n';
		calendarBody += 'URL:' + element.url + '\r\n';
		calendarBody += 'END:VEVENT' + '\r\n';
	});

	calendarBody += 'END:VCALENDAR';
	return calendarBody;
}

exports.handler = (event, context, callback) => {

	https.get({
		host: 'timetableapi.ptv.vic.gov.au',
		path: '/v3/disruptions?devid=3000140&signature=747706dffcb944fd7a1cfc79ebbb4b8b01472ba5'
	}, (response) => {

		var body = '';

		response.on('data', (data) => {
			body += data;
		});

		response.on('end', () => {

			if (response.statusCode === 200) {

				var parsedBody = JSON.parse(body);

				if (parsedBody.status.health === 1 && parsedBody.status.version === '3.0') {

					var disruptions = {};

					// For each route type, i.e. metro_train
					for (var routeType in parsedBody.disruptions) {

						parsedBody.disruptions[routeType].filter((element) => {
							
							// If a disruption does not affect any routes we can disregard
							return element.routes.length > 0;
							
						}).forEach((element) => {

							var disruption = {
								disruption_id: element.disruption_id,
								title: element.title,
								url: element.url,
								description: element.description,
								disruption_status: element.disruption_status,
								disruption_type: element.disruption_type,
								published_on: element.published_on,
								last_updated: element.last_updated,
								from_date: element.from_date,
								to_date: element.to_date,
							}

							element.routes.forEach((element) => {

								if (element.route_id in disruptions) {
									disruptions[element.route_id].disruptions.push(disruption);
								}
								else {
									disruptions[element.route_id] = {
										route_id: element.route_id,
										route_name: element.route_name,
										route_number: element.route_number,
										disruptions: [disruption]
									};
								}
							});
						});
					}

					for (var route in disruptions) {

						let calendarBody = toICal(disruptions[route]);

						var params = {
							Bucket: 'ptv-disruption-calendar',
							Key: route,
							Body: calendarBody,
							ContentType: 'text/calendar',
							Tagging: 'expire=true'
							// TODO: Add `Expires` header to invalidate CloudFront cache after script is re-run
						};

						s3.putObject(params, (error) => {
							if (error) {
								callback(error);
							}
						});
					}
					callback(null);
				}
				else {
					callback(new Error('API Response was unsuccessfully validated'));
				}
			}
			else {
				callback(new Error('Recieved unexpected status code from API call'));
			}
		});
	});
};
