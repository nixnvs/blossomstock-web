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
    
    // Obtener reportes con filtros
    const reportsQuery = `
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
        notas
      FROM reports 
      ${whereClause}
      ORDER BY fecha_reporte DESC
      LIMIT 100
    `;
    
    const reports = await sql(reportsQuery, params);
    
    // Obtener estadísticas mensuales
    let monthlyStats = null;
    if (mes) {
      const monthlyStatsQuery = `
        SELECT 
          SUM(costo) as total_costo,
          COUNT(*) as total_reportes
        FROM reports 
        WHERE mes = $1
        ${categoria && categoria !== 'Todas' ? 'AND categoria = $2' : ''}
      `;
      
      const monthlyParams = [mes];
      if (categoria && categoria !== 'Todas') {
        monthlyParams.push(categoria);
      }
      
      const monthlyResult = await sql(monthlyStatsQuery, monthlyParams);
      monthlyStats = monthlyResult[0];
    }
    
    // Obtener estadísticas por categoría
    const categoryStatsQuery = `
      SELECT 
        categoria,
        SUM(costo) as total_costo,
        COUNT(*) as total_reportes
      FROM reports 
      ${whereClause}
      GROUP BY categoria 
      ORDER BY total_costo DESC
    `;
    
    const categoryStats = await sql(categoryStatsQuery, params);
    
    return Response.json({
      reports,
      monthlyStats,
      categoryStats
    });
    
  } catch (error) {
    console.error('Error fetching reports:', error);
    return Response.json(
      { error: 'Error al obtener los reportes' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      categoria, 
      articulo_id, 
      articulo_nombre, 
      precio_unidad, 
      cantidad = 1, 
      notas 
    } = body;
    
    // Validaciones
    if (!categoria || !articulo_id || !articulo_nombre || !precio_unidad) {
      return Response.json(
        { error: 'Faltan campos requeridos: categoria, articulo_id, articulo_nombre, precio_unidad' },
        { status: 400 }
      );
    }
    
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      return Response.json(
        { error: 'La cantidad debe ser un número entero mayor a 0' },
        { status: 400 }
      );
    }
    
    if (isNaN(parseFloat(precio_unidad)) || parseFloat(precio_unidad) <= 0) {
      return Response.json(
        { error: 'El precio debe ser un número mayor a 0' },
        { status: 400 }
      );
    }
    
    // Verificar que el artículo existe y está activo
    const itemCheck = await sql(`
      SELECT id, categoria as item_categoria 
      FROM items 
      WHERE id = $1 AND activo = true
    `, [articulo_id]);
    
    if (itemCheck.length === 0) {
      return Response.json(
        { error: 'El artículo no existe o no está activo' },
        { status: 400 }
      );
    }
    
    // Verificar coherencia de categoría
    if (itemCheck[0].item_categoria !== categoria) {
      return Response.json(
        { error: 'La categoría no coincide con el artículo seleccionado' },
        { status: 400 }
      );
    }
    
    // Calcular valores
    const precio = parseFloat(precio_unidad);
    const costo = (cantidad * precio).toFixed(2);
    const fechaReporte = new Date();
    const mes = fechaReporte.toISOString().slice(0, 7); // YYYY-MM format
    
    // Insertar reporte
    const result = await sql(`
      INSERT INTO reports (
        categoria, 
        articulo_id, 
        articulo_nombre, 
        precio_unidad, 
        cantidad, 
        costo, 
        fecha_reporte, 
        mes, 
        notas
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
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
    `, [
      categoria,
      articulo_id,
      articulo_nombre,
      precio,
      cantidad,
      parseFloat(costo),
      fechaReporte,
      mes,
      notas
    ]);
    
    return Response.json(result[0], { status: 201 });
    
  } catch (error) {
    console.error('Error creating report:', error);
    return Response.json(
      { error: 'Error al crear el reporte' },
      { status: 500 }
    );
  }
}