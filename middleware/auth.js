const isLoggedIn = (req, res, next) => {
    if (!req.session?.user) {
        return res.status(401).json({ message: 'Unauthorized: กรุณา login ก่อน' });
    }
    next();
};

const isAdmin = (req, res, next) => {
    if (!req.session?.user) {
        return res.status(401).json({ message: 'Unauthorized: กรุณา login ก่อน' });
    }
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: เฉพาะ admin เท่านั้น' });
    }
    next();
};

const isCandidate = (req, res, next) => {
    if (!req.session?.user) {
        return res.status(401).json({ message: 'Unauthorized: กรุณา login ก่อน' });
    }
    if (req.session.user.role !== 'candidate') {
        return res.status(403).json({ message: 'Forbidden: เฉพาะ candidate เท่านั้น' });
    }
    next();
};

module.exports = { isLoggedIn, isAdmin, isCandidate };
