
const schedule = require('node-schedule');

const job = schedule.scheduleJob('*/1 * * * * *', function(){
  console.log('bru');
});