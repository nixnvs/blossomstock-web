import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const body = await request.json();
    const { confirmation } = body;

    // Verificar que la confirmación es correcta
    if (confirmation !== "BORRAR TODO") {
      return Response.json(
        { error: "Confirmación incorrecta. Debes escribir exactamente 'BORRAR TODO'" },
        { status: 400 }
      );
    }

    // Ejecutar las eliminaciones en orden correcto usando transacción
    await sql.transaction([
      sql`DELETE FROM recuento_lineas`,
      sql`DELETE FROM recuentos`,
      sql`DELETE FROM reports`,
      sql`DELETE FROM items`
    ]);

    return Response.json({
      success: true,
      message: "Base de datos reiniciada correctamente. Todas las tablas han sido vaciadas."
    });

  } catch (error) {
    console.error("Error resetting database:", error);
    return Response.json(
      { error: "Error al reiniciar la base de datos" },
      { status: 500 }
    );
  }
}