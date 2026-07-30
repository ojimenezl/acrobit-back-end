/**
 * Validación de variables de entorno al arrancar.
 * Si falta algo crítico, la app no levanta (evita errores silenciosos en prod).
 */
export function validateEnv(config: Record<string, unknown>) {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'OPENAI_API_KEY'];
  const missing = required.filter((key) => !config[key]);

  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${missing.join(', ')}. ` +
        `Revisa tu archivo .env`,
    );
  }

  return config;
}
