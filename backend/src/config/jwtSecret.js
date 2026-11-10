const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret === 'development_secret_key_change_in_production') {
    throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in .env');
}
module.exports = secret;
