import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    // Obtener recuentos cerrados ordenados por fecha más reciente
    const recuentos = await sql`
      SELECT 
        id,
        mes,
        estado,
        fecha_creacion,
        fecha_cierre
      FROM recuentos 
      WHERE estado = 'Cerrado'
      ORDER BY fecha_cierre DESC
    `;

    return Response.json(recuentos);
  } catch (error) {
    console.error("Error al obtener recuentos cerrados:", error);
    return Response.json(
      { error: "Error al obtener recuentos cerrados" },
      { status: 500 }
    );
  }
}