require("../src/config/env")();

const bcrypt = require("bcrypt");
const prisma = require("../src/prisma/prisma");

const VISITOR_USER = {
  nome: "Visitante",
  email: "visitante@orbis.com",
  senha: "Visita@123",
  role: "VISITANTE",
  especialidade: "visitar",
  ativo: true
};

async function main() {
  const senhaHash = await bcrypt.hash(VISITOR_USER.senha, 10);
  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: VISITOR_USER.email },
    select: { id: true }
  });

  const data = {
    nome: VISITOR_USER.nome,
    senha: senhaHash,
    role: VISITOR_USER.role,
    especialidade: VISITOR_USER.especialidade,
    ativo: VISITOR_USER.ativo
  };

  const usuario = usuarioExistente
    ? await prisma.usuario.update({
        where: { email: VISITOR_USER.email },
        data,
        select: {
          id: true,
          nome: true,
          email: true,
          role: true,
          especialidade: true,
          ativo: true
        }
      })
    : await prisma.usuario.create({
        data: {
          ...data,
          email: VISITOR_USER.email
        },
        select: {
          id: true,
          nome: true,
          email: true,
          role: true,
          especialidade: true,
          ativo: true
        }
      });

  console.log("visitor_user_ready", usuario);
}

main()
  .catch((error) => {
    console.error("visitor_user_failed", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
