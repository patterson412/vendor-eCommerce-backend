const jwt = require('jsonwebtoken');
const passport = require('passport');
const { Strategy: JwtStrategy } = require('passport-jwt');
const { ExtractJwt } = require('passport-jwt');
const { userService } = require('../services');
const config = require('../config/config');

const cookieExtractor = (req) => {
    try {
        if (req && req.cookies && req.cookies['token']) {
            return req.cookies['token'];
        }
        return null;
    } catch (error) {
        console.error('Cookie extraction error:', error);
        return null;
    }
};

const options = {
    jwtFromRequest: cookieExtractor,
    secretOrKey: config.jwt.secret
}

// JWT Strategy
passport.use(
    new JwtStrategy(options, async (jwtPayload, done) => {
        try {
            // Find user by id from JWT payload
            const user = await userService.getUserById(jwtPayload.id);

            if (!user) {
                return done(null, false);
            }

            return done(null, user);
        } catch (error) {
            return done(error, false);
        }
    })
);

module.exports = passport.authenticate('jwt', { session: false });