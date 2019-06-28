// app/models/user.js
// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

var properties_ownedSchema = mongoose.Schema({
  property_id          : String,
  percent_owned        : Number,
  total_earned         : Number
});

// define the schema for our user model
var userSchema = mongoose.Schema({

    local            : {
        email        : String,
        password     : String,
    },
    facebook         : {
        id           : String,
        token        : String,
        name         : String,
        email        : String,
        photo        : String
    },
    twitter          : {
        id           : String,
        token        : String,
        displayName  : String,
        username     : String,
        photo        : String
    },
    google           : {
        id           : String,
        token        : String,
        email        : String,
        name         : String,
        photo        : String
    },
    income           : {
        last_day     : {type: Number, default: 0},
        last_week    : {type: Number, default: 0},
        last_month   : {type: Number, default: 0},
        last_year    : {type: Number, default: 0}
    },
    property           : {
        total_properties      : {type: Number, default: 0},
        max_properties        : {type: Number, default: 5},
        total_pending         : {type: Number, default: 0},
        max_pending           : {type: Number, default: 2},
        owned                 : [properties_ownedSchema]
    },
    permissions      : {
      admin : {type: Boolean, default: false}
    },
    portfolio_value  : {type: Number, default: 0},
    cash_on_hand     : {type: Number, default: 100},
    cash_on_hand_bonus_limit : {type: Number, default: 0},
    cash_tied_up     : {type: Number, default: 0},
    level            : {type: Number, default: 0},
    groupies         : {type: Number, default: 0},
    company_name     : {type: String, default: "Default Name"},
    last_online      : {type: Date, default: Date.now}

});

// methods ======================
// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);


