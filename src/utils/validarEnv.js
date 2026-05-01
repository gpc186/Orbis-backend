function validarEnv() {
    const obrigatorias = [
        "DATABASE_URL",
        "JWT_SECRET",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE"
    ];

    const faltando = obrigatorias.filter((chave) => !process.env[chave]);

    if (faltando.length > 0) {
        throw new Error(`Variáveis ausentes: ${faltando.join(", ")}`);
    }
}

module.exports = validarEnv