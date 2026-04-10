const ManutecaoModel = require("../models/manutencaoModel");
const UsuarioModel = require("../models/usuarioModel");
const prisma = require("../prisma/prisma");
const AppError = require("../utils/appErrorUtils");

class ManutecaoService {
    static async create({ alertaId, usuarioId, observacao, status }){
        const alerta = await prisma.alerta.findUnique({
            where: {id: alertaId}
        })
        if(!alerta){
            throw new AppError("Alerta não existe!", 404);
        };

        if(alerta.status === "RESOLVIDO" || alerta.status === "CANCELADO"){
            throw new AppError("Não é possivel criar uma manutenção de um status que acabou!", 400);
        };

        const usuario = await UsuarioModel.findById(usuarioId);

        if(!usuario){
            throw new AppError("Usuario não encontrado!", 404);
        };

        if(!usuario.ativo){
            throw new AppError("Não é possivel colocar um usuario inativo!", 400);
        };

        if(observacao.length < 3){
            throw new AppError("Observação não é válida!", 400);
        };

        const resultado = await ManutecaoModel.create({ alertaId, usuarioId, observacao, status });
        return resultado;
    };

    static async list({ page, limit }){
        const pageNum = parseInt(page);
        const take = parseInt(limit);
        const skip = (pageNum - 1) * take;
        const [ dados, total ] = await Promise.all([
            ManutecaoModel.findAll({skip, take}),
            ManutecaoModel.count()
        ]);

        const totalPages = Math.ceil(total / limit);

        return { dados, total, page: pageNum, totalPages };
    };

    static async findByalertaId(id){
        const alerta = await prisma.alerta.findUnique({
            where: id
        });
        
        if(!alerta){
            throw new AppError("Não foi possível encontrar o alerta!", 404);
        };
        
        const manutencoes = await ManutecaoModel.findByAlertaId(alerta.id);

        return [manutencoes]
    };

    static async findById(id){
        const manutencao = await ManutecaoModel.findById(id);
        
        if(!manutencao){
            throw new AppError("Não foi possivel encontrar a manutenção!", 404);
        };

        return manutencao;
    }

    static async update(id, {dados}){
        const manutencao = await ManutecaoModel.findById(id);
        if(!manutencao){
            throw new AppError("Manuteção não foi encontrada!", 404);
        };
        if(manutencao.status === "RESOLVIDO"){
            throw new AppError("Manutenção já foi resolvida, não é possivel alterar!", 409);
        };

        if(dados.observacao.length < 3){
            throw new AppError("Observação não é válida!", 400);
        };

        if(dados.status != "EM_ANDAMENTO" || dados.status != "RESOLVIDO"){
            throw new AppError("Status não é válido!", 400);
        };

        const resultado = await ManutecaoModel.update({id, dados})
        return resultado;
    };
}

module.exports = ManutecaoService;