const mongoose = require('mongoose')
const express = require('express')
const Joi = require('joi')
const _ = require('lodash')
const bcrypt = require('bcrypt')
const { authLimiter } = require('../middleware/rateLimiter');

const {User} = require('../models/User')

const router = express.Router()

router.post('/', authLimiter, async (req,res) =>{
    const {error} = validate(req.body)
    if(error) return res.status(400).send(error.details[0].message)

    let user = await User.findOne({ email: req.body.email })
    if(!user) return res.status(400).send('Invalid email or password.')

    if (user.isDeleted) {
        return res.status(403).send('This account has been deleted.');
    }
    
    const validPassword = await bcrypt.compare(req.body.password, user.password)
    if(!validPassword) return res.status(400).send('Invalid email or password.')

    const token = user.generateAuthToken()
    res.send({
        token,
        user: {
            _id: user._id,
            Firstname: user.Firstname,
            Lastname: user.Lastname,
            email: user.email,
            role: user.role,
            points: user.points,
            discount: user.discount,
            companyName: user.companyName,
            phoneNumber: user.phoneNumber,
            billingAddress: user.billingAddress,
            shippingAddress: user.shippingAddress,
        }
    });
})


function validate(req){
    const schema = Joi.object({
        email: Joi.string().required().min(5).max(255).email(),
        password: Joi.string().required().min(5).max(255)
    })
    return schema.validate(req)
}


module.exports = router