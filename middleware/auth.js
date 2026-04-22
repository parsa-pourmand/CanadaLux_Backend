const jwt = require('jsonwebtoken')

function auth(req, res, next){
    const token = req.header('x-auth-token')
    if(!token) return res.status(401).send('Access denied. No token provided.')

    try{
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY)
        req.user = decoded
        next()
    } catch(ex){
        if (ex.name === 'TokenExpiredError') {
            return res.status(401).send('Token expired. Please log in again.');
        }

        res.status(400).send('Invalid token.');
    }
}

module.exports = auth