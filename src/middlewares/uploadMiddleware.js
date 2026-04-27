const multer = require('multer');
const sharp = require('sharp');
const AppError = require('../utils/appErrorUtils');

const allowedMimeTypes = ["image/png", "image/jpg", "image/jpeg", "image/webp"]

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            cb(new AppError("Tipo de imagem não suportada!", 400))
        };

        cb(null, true);
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
        
    } catch (error) {
        next(new AppError("Erro ao processar imagem!", 500))
    }
}