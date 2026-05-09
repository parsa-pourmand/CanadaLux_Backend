const jwt = require('jsonwebtoken');
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
    profileImage: {
        type: String,
        maxlength: 5000,
        default: '',
        trim: true
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
        default: ''
    },
    shippingAddress: {
        type: String,
        maxlength: 255,
        default: '',
    },
    points: {
        type: Number,
        default: 0,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
    },
});

userSchema.methods.generateAuthToken = function() {
    const token = jwt.sign(
        { _id: this._id,  
            role: this.role 
        },
        process.env.JWT_PRIVATE_KEY,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
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
        billingAddress: Joi.string().max(255).allow('').optional(),
        shippingAddress: Joi.string().max(255).allow('').optional(),
        profileImage: Joi.string().max(5000).allow('').optional()
    });
    return schema.validate(user);
}
    
function validateUserPatch(user) {
    const schema = Joi.object({
        email: Joi.string().min(5).max(255).email(),
        password: Joi.string().min(5).max(255),
        currentPassword: Joi.string().min(5).max(255),
        phoneNumber: Joi.string().max(20).allow(''),
        billingAddress: Joi.string().max(255).allow(''),
        shippingAddress: Joi.string().max(255).allow(''),
        companyName: Joi.string().max(255).allow(''),
        profileImage: Joi.string().max(5000).allow('').optional()

    }).min(1);

    return schema.validate(user);
}

const User = mongoose.model('User', userSchema);

module.exports.User = User;
module.exports.validatePatch = validateUserPatch;
module.exports.validate = validateUser;