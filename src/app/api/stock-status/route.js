import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get("mes");

    if (!mes) {
      return Response.json(
        { error: "Parámetro mes es requerido (formato YYYY-MM)" },
        { status: 400 }
      );
    }

    // Buscar el recuento del mes (preferir Cerrado sobre Borrador)
    const recuentos = await sql`
      SELECT id, mes, estado, fecha_creacion, fecha_cierre
      FROM recuentos 
      WHERE mes = ${mes}
      ORDER BY CASE WHEN estado = 'Cerrado' THEN 1 ELSE 2 END, fecha_creacion DESC
      LIMIT 1
    `;

    if (recuentos.length === 0) {
      return Response.json({
        mes,
        recuento: null,
        kpis: {
          porcentajeCompletos: 0,
          articulosConFaltantes: 0,
          categoriaMasAfectada: null
        },
        categorias: []
      });
    }

    const recuento = recuentos[0];

    // Obtener todas las líneas del recuento con sus datos
    const lineas = await sql`
      SELECT 
        rl.id,
        rl.articulo_nombre,
        rl.categoria,
        rl.cantidad_objetivo,
        rl.cantidad_actual,
        rl.nota_linea
      FROM recuento_lineas rl
      WHERE rl.recuento_id = ${recuento.id}
      ORDER BY rl.categoria ASC, rl.articulo_nombre ASC
    `;

    // Calcular KPIs
    const totalArticulos = lineas.length;
    const articulosCompletos = lineas.filter(l => l.cantidad_actual === l.cantidad_objetivo).length;
    const articulosConFaltantes = lineas.filter(l => l.cantidad_actual < l.cantidad_objetivo).length;
    const porcentajeCompletos = totalArticulos > 0 ? Math.round((articulosCompletos / totalArticulos) * 100) : 0;

    // Calcular categoría más afectada
    const faltantesPorCategoria = {};
    lineas.forEach(linea => {
      if (linea.cantidad_actual < linea.cantidad_objetivo) {
        faltantesPorCategoria[linea.categoria] = (faltantesPorCategoria[linea.categoria] || 0) + 1;
      }
    });

    let categoriaMasAfectada = null;
    let maxFaltantes = 0;
    Object.entries(faltantesPorCategoria).forEach(([categoria, faltantes]) => {
      if (faltantes > maxFaltantes) {
        maxFaltantes = faltantes;
        categoriaMasAfectada = categoria;
      }
    });

    // Agrupar por categorías y calcular progreso
    const categoriesMap = {};
    lineas.forEach(linea => {
      if (!categoriesMap[linea.categoria]) {
        categoriesMap[linea.categoria] = {
          nombre: linea.categoria,
          totalActual: 0,
          totalObjetivo: 0,
          articulos: []
        };
      }

      const categoria = categoriesMap[linea.categoria];
      categoria.totalActual += linea.cantidad_actual;
      categoria.totalObjetivo += linea.cantidad_objetivo;
      
      // Determinar color del artículo
      let estado = 'rojo'; // < 70%
      if (linea.cantidad_actual === linea.cantidad_objetivo) {
        estado = 'verde'; // 100%
      } else if (linea.cantidad_actual >= Math.floor(linea.cantidad_objetivo * 0.7)) {
        estado = 'amarillo'; // >= 70%
      }

      categoria.articulos.push({
        id: linea.id,
        nombre: linea.articulo_nombre,
        cantidadActual: linea.cantidad_actual,
        cantidadObjetivo: linea.cantidad_objetivo,
        porcentaje: linea.cantidad_objetivo > 0 ? Math.round((linea.cantidad_actual / linea.cantidad_objetivo) * 100) : 0,
        estado,
        nota: linea.nota_linea
      });
    });

    // Convertir a array y calcular progreso por categoría
    const categorias = Object.values(categoriesMap).map(categoria => ({
      ...categoria,
      porcentajeProgreso: categoria.totalObjetivo > 0 
        ? Math.round((categoria.totalActual / categoria.totalObjetivo) * 100) 
        : 0
    }));

    return Response.json({
      mes,
      recuento: {
        id: recuento.id,
        estado: recuento.estado,
        fechaCreacion: recuento.fecha_creacion,
        fechaCierre: recuento.fecha_cierre
      },
      kpis: {
        porcentajeCompletos,
        articulosConFaltantes,
        categoriaMasAfectada,
        totalArticulos
      },
      categorias
    });

  } catch (error) {
    console.error('Error fetching stock status:', error);
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}