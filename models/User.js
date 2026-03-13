const jwt = require('jsonwebtoken');
const config = require('config');
const mongoose = require('mongoose');
const Joi = require('joi');

const userSchema = new mongoose.Schema({
    Firstname: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 50,
        trim: true
    },
    Lastname: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 50,
        trim: true
    },
    email: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 255,
        lowercase: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 255,
        trim: true
    },
    companyName: {
        type: String,
        maxlength: 255,
        default: '',
    },
    phoneNumber: {
        type: String,
        maxlength: 20,
        default: '',
        required: true
    },
    billingAddress: {
        type: String,
        maxlength: 255,
        default: '',
        required: true
    },
    shippingAddress: {
        type: String,
        maxlength: 255,
        default: '',
        required: true
    },
    points: {
        type: Number,
        default: 0,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.methods.generateAuthToken = function() {
    const token = jwt.sign(
        { _id: this._id, Firstname: this.Firstname, Lastname: this.Lastname, email: this.email, points: this.points, shippingAddress: this.shippingAddress },
        config.get('jwtPrivateKey')
    );
    return token;
};

function validateUser(user) {
    const schema = Joi.object({
        Firstname: Joi.string().min(2).max(50).required(),
        Lastname: Joi.string().min(2).max(50).required(),
        email: Joi.string().min(5).max(255).required().email(),
        password: Joi.string().min(5).max(255).required(),
        companyName: Joi.string().max(255).allow('').optional(),
        phoneNumber: Joi.string().max(20).allow('').required(),
        billingAddress: Joi.string().max(255).allow('').required(),
        shippingAddress: Joi.string().max(255).allow('').required(),
        points: Joi.number().min(0).optional()
    });
    return schema.validate(user);
}
    
function validateUserPatch(user) {
    const schema = Joi.object({
        email: Joi.string().min(5).max(255).email(),
        password: Joi.string().min(5).max(255),
        oldPassword: Joi.string().min(5).max(255),
        phoneNumber: Joi.string().max(20).allow(''),
        billingAddress: Joi.string().max(255).allow(''),
        shippingAddress: Joi.string().max(255).allow('')

    }).min(1);

    return schema.validate(user);
}

const User = mongoose.model('User', userSchema);

module.exports.User = User;
module.exports.validatePatch = validateUserPatch;
module.exports.validate = validateUser;