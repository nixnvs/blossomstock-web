import sql from "@/app/api/utils/sql";

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }

    // Delete the report
    const result = await sql`
      DELETE FROM reports 
      WHERE id = ${parseInt(id)}
      RETURNING id, articulo_nombre
    `;

    if (result.length === 0) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    return Response.json({ 
      success: true, 
      message: `Report for ${result[0].articulo_nombre} deleted successfully` 
    });

  } catch (error) {
    console.error('Error deleting report:', error);
    return Response.json({ error: 'Failed to delete report' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }

    // Get the specific report
    const report = await sql`
      SELECT 
        id,
        categoria,
        articulo_id,
        articulo_nombre,
        precio_unidad,
        cantidad,
        costo,
        fecha_reporte,
        mes,
        notas,
        created_at
      FROM reports 
      WHERE id = ${parseInt(id)}
    `;

    if (report.length === 0) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    return Response.json(report[0]);

  } catch (error) {
    console.error('Error fetching report:', error);
    return Response.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}