/**
 * Punto de arranque del servidor. `register` corre una sola vez por instancia
 * de Next; aqui se imprime el banner de configuracion y nada mas. El import va
 * dentro de la funcion para que el runtime de Edge no cargue modulos de Node.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logStartup } = await import('./server/startup');
    logStartup();
  }
}
