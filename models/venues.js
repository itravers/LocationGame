// app/models/jQuestions.js
// questions from quiz bowl
// load the things we need
var mongoose = require('mongoose');
var random   = require('mongoose-simple-random');

// define the schema for our user model
var venuesSchema = mongoose.Schema({
    _id              : Object,
    venue_id         : String,   
    lat              : Number, 
    longi            : Number,   
    location         : Object,   
    venue_category_name         : String,   
    country_code     : String
},
{
  collection: 'venues'
});

//add random ability to schema
venuesSchema.plugin(random);

// create the model for quizQuestions and expose it to our app
module.exports = mongoose.model('venues', venuesSchema);


