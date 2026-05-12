module.exports = (req, res) => {
    res.status(200).json({ 
        message: "JS Pong!", 
        time: new Date().toISOString(),
        node_version: process.version
    });
};
