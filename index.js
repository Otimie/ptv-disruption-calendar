'use strict';

const https = require('https');

const AWS = require('aws-sdk');

exports.handler = (event, context, callback) => {

	https.get({
		host: 'timetableapi.ptv.vic.gov.au',
		path: '/v3/disruptions?devid=3000140&signature=747706dffcb944fd7a1cfc79ebbb4b8b01472ba5'
	}, function (response) {

		var body = '';

		response.on('data', function (data) {
			body += data;
		});

		response.on('end', function () {

			if (response.statusCode === 200) {
				
				var parsedBody = JSON.parse(body);

				if (parsedBody.status.health === 1 && parsedBody.status.version === '3.0') {

					var disruptions = {};

					// For each route type, i.e. metro_train
					for (var routeType in parsedBody.disruptions) {

						parsedBody.disruptions[routeType].forEach(function (element) {

							// If a disruption does not affect any routes we can disregard
							if (element.routes.length > 0) {

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

								element.routes.forEach(function (element) {

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

							}
						});

					}

					// Specify the S3 API version
					var s3 = new AWS.S3({apiVersion: '2006-03-01'});
					
					for (var route in disruptions) {
						
						var calendarBody = 'BEGIN:VCALENDAR\r\n';
						calendarBody += 'VERSION:2.0\r\n';
						calendarBody += 'X-WR-CALNAME:Disruptions for ' + (disruptions[route].route_number ? disruptions[route].route_number + ' - ': '') + disruptions[route].route_name + '\r\n';
						calendarBody += 'PRODID:-//ABC Corporation//NONSGML My Product//EN\r\n';
						
						disruptions[route].disruptions.forEach(function (element) {
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
						
						var params = {
							Bucket: 'ptv-disruption-calendar',
							Key: route,
							Body: calendarBody,
							ContentType: 'text/calendar'
						};

						s3.putObject(params, function(error, data) {
							if (error) {
								console.log(error, error.stack);
							}
							else {
								console.log(data);
							}
						});

						
					}
				}
				else {
					var error = new Error('API Response was unsuccessfully validated');
					callback(error);
				}
			}
			else {
				var error = new Error('Recieved unexpected status code from API call');
				callback(error);
			}
		});
	});
};
