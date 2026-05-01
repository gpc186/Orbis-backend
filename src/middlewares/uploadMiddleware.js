const multer = require('multer');
const sharp = require('sharp');
const AppError = require('../utils/appErrorUtils');

const allowedMimeTypes = ["image/png", "image/jpg", "image/jpeg", "image/webp"]

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new AppError("Tipo de imagem não suportada!", 400), false)
        };

        return cb(null, true);
    },
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

async function processarImagem(bufferOriginal) {
    const bufferProcessado = await sharp(bufferOriginal)
        .rotate()
        .resize({
            width: 600,
            height: 600,
            fit: "inside",
            withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toBuffer();
    return bufferProcessado
}

async function imagemProcessada(req, res, next) {
    if(!req.file) return next(new AppError("Imagem não encontrada!", 400));

    try {
        const imagemProcessada = await processarImagem(req.file.buffer);

        req.file.buffer = imagemProcessada;
        req.file.mimetype = "image/webp";
        
        return next();
    } catch (error) {
        return next(new AppError("Erro ao processar imagem!", 500));
    };
};

module.exports = { uploadImagemUnica: upload.single("imagem"), imagemProcessada };