import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes'); // formato YYYY-MM
    const categoria = searchParams.get('categoria');
    
    // Construir query base con filtros
    let whereConditions = [];
    let params = [];
    let paramCount = 0;
    
    if (mes) {
      paramCount++;
      whereConditions.push(`mes = $${paramCount}`);
      params.push(mes);
    }
    
    if (categoria && categoria !== 'Todas') {
      paramCount++;
      whereConditions.push(`categoria = $${paramCount}`);
      params.push(categoria);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    
    // Obtener reportes para exportar
    const reportsQuery = `
      SELECT 
        categoria,
        articulo_nombre,
        cantidad,
        precio_unidad,
        costo,
        fecha_reporte,
        mes,
        notas
      FROM reports 
      ${whereClause}
      ORDER BY fecha_reporte DESC
    `;
    
    const reports = await sql(reportsQuery, params);
    
    if (reports.length === 0) {
      return Response.json(
        { error: 'No hay reportes para exportar con los filtros seleccionados' },
        { status: 404 }
      );
    }
    
    // Generar CSV
    const headers = [
      'Categoría',
      'Artículo',
      'Cantidad', 
      'Precio Unitario (€)',
      'Costo Total (€)',
      'Fecha Reporte',
      'Mes',
      'Notas'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    reports.forEach(report => {
      const row = [
        report.categoria,
        `"${report.articulo_nombre}"`, // Escapar comillas para CSV
        report.cantidad,
        parseFloat(report.precio_unidad).toFixed(2),
        parseFloat(report.costo).toFixed(2),
        new Date(report.fecha_reporte).toLocaleDateString('es-ES'),
        report.mes,
        report.notas ? `"${report.notas.replace(/"/g, '""')}"` : '' // Escapar comillas en notas
      ];
      csvContent += row.join(',') + '\n';
    });
    
    // Crear filename con fecha y filtros
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    let filename = `blossom-reportes-${timestamp}`;
    
    if (mes) {
      filename += `-${mes}`;
    }
    if (categoria && categoria !== 'Todas') {
      filename += `-${categoria.toLowerCase()}`;
    }
    filename += '.csv';
    
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      },
    });
    
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return Response.json(
      { error: 'Error al exportar CSV' },
      { status: 500 }
    );
  }
}