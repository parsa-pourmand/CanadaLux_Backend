const jwt = require('jsonwebtoken');
const config = require('config');
const mongoose = require('mongoose');
const Joi = require('joi');

const userSchema = new mongoose.Schema({
    Firstname: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 50
    },
    Lastname: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 255,
        unique: true
    },
    password: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 1024
    }
});

userSchema.methods.generateAuthToken = function() {
    const token = jwt.sign(
        { _id: this._id, Firstname: this.Firstname, Lastname: this.Lastname, email: this.email },
        config.get('jwtPrivateKey')
    );
    return token;
};

function validateUser(user) {
    const schema = Joi.object({
        Firstname: Joi.string().min(2).max(50).required(),
        Lastname: Joi.string().min(2).max(50).required(),
        email: Joi.string().min(5).max(255).required().email(),
        password: Joi.string().min(5).max(255).required()
    });
    return schema.validate(user);
}
    
const User = mongoose.model('User', userSchema);

module.exports.User = User;
module.exports.validate = validateUser;