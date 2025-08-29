import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return Response.json(
        { error: "ID del recuento es requerido" },
        { status: 400 },
      );
    }

    // Verificar que el recuento existe
    const recuento = await sql(
      `SELECT id, mes, estado, fecha_creacion, fecha_cierre FROM recuentos WHERE id = $1`,
      [id],
    );

    if (recuento.length === 0) {
      return Response.json(
        { error: "Recuento no encontrado" },
        { status: 404 },
      );
    }

    // Obtener las líneas del recuento con diferencia > 0 (solo las que necesitan compra)
    const lineas = await sql(
      `
      SELECT 
        rl.id,
        rl.articulo_nombre,
        rl.categoria,
        rl.precio_unidad,
        rl.cantidad_objetivo,
        rl.cantidad_actual,
        rl.nota_linea,
        i.proveedor,
        i.proveedor_url,
        -- Calcular diferencia (cantidad a comprar)
        GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) as a_comprar,
        -- Calcular subtotal
        GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) * rl.precio_unidad as subtotal
      FROM recuento_lineas rl
      LEFT JOIN items i ON i.id = rl.item_id
      WHERE rl.recuento_id = $1
        AND GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) > 0
      ORDER BY rl.categoria ASC, rl.articulo_nombre ASC
    `,
      [id],
    );

    // Agrupar por categoría
    const categorias = {};
    lineas.forEach((linea) => {
      if (!categorias[linea.categoria]) {
        categorias[linea.categoria] = {
          categoria: linea.categoria,
          lineas: [],
          total: 0,
        };
      }
      categorias[linea.categoria].lineas.push(linea);
      categorias[linea.categoria].total += parseFloat(linea.subtotal);
    });

    // Convertir a array y calcular total general
    const categoriasArray = Object.values(categorias);
    const totalGeneral = categoriasArray.reduce(
      (total, cat) => total + cat.total,
      0,
    );

    // Obtener totales por categoría para el resumen
    const totalPorCategoria = await sql(
      `
      SELECT 
        categoria,
        COUNT(*) as items_a_comprar,
        SUM(GREATEST(cantidad_objetivo - cantidad_actual, 0) * precio_unidad) as total_categoria
      FROM recuento_lineas
      WHERE recuento_id = $1
        AND GREATEST(cantidad_objetivo - cantidad_actual, 0) > 0
      GROUP BY categoria
      ORDER BY categoria ASC
    `,
      [id],
    );

    return Response.json({
      recuento: recuento[0],
      categorias: categoriasArray,
      totalGeneral: totalGeneral,
      resumen: {
        totalItems: lineas.length,
        totalCategorias: categoriasArray.length,
        totalPorCategoria: totalPorCategoria,
      },
    });
  } catch (error) {
    console.error("Error fetching reporte:", error);
    return Response.json(
      { error: "Error al obtener el reporte" },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { action } = body;

    if (!id) {
      return Response.json(
        { error: "ID del recuento es requerido" },
        { status: 400 },
      );
    }

    // Verificar que el recuento existe y está cerrado
    const recuento = await sql(
      `SELECT id, mes, estado FROM recuentos WHERE id = $1`,
      [id],
    );

    if (recuento.length === 0) {
      return Response.json(
        { error: "Recuento no encontrado" },
        { status: 404 },
      );
    }

    if (recuento[0].estado !== "Cerrado") {
      return Response.json(
        { error: "El recuento debe estar cerrado para generar reportes" },
        { status: 400 },
      );
    }

    if (action === "export_csv") {
      // Obtener datos para CSV
      const lineas = await sql(
        `
        SELECT 
          rl.categoria,
          rl.articulo_nombre as articulo,
          rl.cantidad_objetivo,
          rl.cantidad_actual,
          GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) as a_comprar,
          rl.precio_unidad,
          GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) * rl.precio_unidad as subtotal,
          i.proveedor,
          i.proveedor_url
        FROM recuento_lineas rl
        LEFT JOIN items i ON i.id = rl.item_id
        WHERE rl.recuento_id = $1
          AND GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) > 0
        ORDER BY rl.categoria ASC, rl.articulo_nombre ASC
      `,
        [id],
      );

      if (lineas.length === 0) {
        return Response.json(
          { error: "No hay artículos para comprar en este recuento" },
          { status: 404 },
        );
      }

      // Generar CSV
      const headers = [
        "Categoría",
        "Artículo",
        "Cantidad Objetivo",
        "Cantidad Actual",
        "A Comprar",
        "Precio Unidad (€)",
        "Subtotal (€)",
        "Proveedor",
        "URL Proveedor",
      ];

      let csvContent = headers.join(",") + "\n";

      lineas.forEach((linea) => {
        const row = [
          linea.categoria,
          `"${linea.articulo}"`,
          linea.cantidad_objetivo,
          linea.cantidad_actual,
          linea.a_comprar,
          parseFloat(linea.precio_unidad).toFixed(2),
          parseFloat(linea.subtotal).toFixed(2),
          linea.proveedor ? `"${linea.proveedor}"` : "",
          linea.proveedor_url || "",
        ];
        csvContent += row.join(",") + "\n";
      });

      // Crear filename
      const filename = `blossom-reporte-${recuento[0].mes}.csv`;

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    if (action === "generate_summary") {
      const body = await request.json();
      const { view_mode = "categoria" } = body;

      // Obtener datos para el resumen
      const lineas = await sql(
        `
        SELECT 
          rl.categoria,
          rl.articulo_nombre,
          GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) as a_comprar,
          rl.precio_unidad,
          GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) * rl.precio_unidad as subtotal,
          i.proveedor,
          i.proveedor_url
        FROM recuento_lineas rl
        LEFT JOIN items i ON i.id = rl.item_id
        WHERE rl.recuento_id = $1
          AND GREATEST(rl.cantidad_objetivo - rl.cantidad_actual, 0) > 0
        ORDER BY rl.categoria ASC, rl.articulo_nombre ASC
      `,
        [id],
      );

      if (lineas.length === 0) {
        return Response.json({
          summary: "No hay artículos para comprar en este recuento.",
          plainText: "No hay artículos para comprar en este recuento.",
        });
      }

      // Generar resumen en HTML
      const formatMonth = (monthStr) => {
        const date = new Date(monthStr + "-01");
        return date.toLocaleDateString("es-ES", {
          month: "long",
          year: "numeric",
        });
      };

      let summary = `<h2>🌸 Blossom — Reposición ${formatMonth(
        recuento[0].mes,
      )}</h2>\n\n`;

      const totalGeneral = lineas.reduce(
        (total, linea) => total + parseFloat(linea.subtotal),
        0,
      );
      summary += `<p><strong>Total general: €${totalGeneral.toFixed(2)}</strong></p>\n\n`;

      if (view_mode === "proveedor") {
        // Agrupar por proveedor
        const proveedores = {};
        lineas.forEach((linea) => {
          const proveedor = linea.proveedor || "Proveedor desconocido";
          if (!proveedores[proveedor]) {
            proveedores[proveedor] = {
              lineas: [],
              proveedor_url: linea.proveedor_url,
            };
          }
          proveedores[proveedor].lineas.push(linea);
        });

        // Ordenar proveedores alfabéticamente
        Object.keys(proveedores)
          .sort()
          .forEach((proveedor) => {
            const proveedorData = proveedores[proveedor];
            summary += `<h3>${proveedor}</h3>\n<ul>\n`;

            // Ordenar artículos alfabéticamente
            proveedorData.lineas.sort((a, b) =>
              a.articulo_nombre.localeCompare(b.articulo_nombre),
            );

            proveedorData.lineas.forEach((linea) => {
              const enlace = proveedorData.proveedor_url
                ? ` — <a href="${proveedorData.proveedor_url}" target="_blank">Comprar</a>`
                : "";
              summary += `  <li>${linea.articulo_nombre} (${linea.categoria}) — ${
                linea.a_comprar
              } × €${parseFloat(linea.precio_unidad).toFixed(2)} = €${parseFloat(
                linea.subtotal,
              ).toFixed(2)}${enlace}</li>\n`;
            });
            summary += `</ul>\n\n`;
          });
      } else {
        // Agrupar por categoría (comportamiento original)
        const categorias = {};
        lineas.forEach((linea) => {
          if (!categorias[linea.categoria]) {
            categorias[linea.categoria] = [];
          }
          categorias[linea.categoria].push(linea);
        });

        Object.keys(categorias).forEach((categoria) => {
          summary += `<h3>${categoria}</h3>\n<ul>\n`;
          categorias[categoria].forEach((linea) => {
            const enlace = linea.proveedor_url
              ? ` — <a href="${linea.proveedor_url}" target="_blank">Comprar</a>`
              : linea.proveedor
                ? ` — ${linea.proveedor}`
                : "";
            summary += `  <li>${linea.articulo_nombre} — ${
              linea.a_comprar
            } × €${parseFloat(linea.precio_unidad).toFixed(2)} = €${parseFloat(
              linea.subtotal,
            ).toFixed(2)}${enlace}</li>\n`;
          });
          summary += `</ul>\n\n`;
        });
      }

      return Response.json({
        summary: summary.trim(),
        plainText: summary.replace(/<[^>]*>/g, "").trim(), // Versión sin HTML
      });
    }

    return Response.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Error processing reporte action:", error);
    return Response.json(
      { error: "Error al procesar la acción del reporte" },
      { status: 500 },
    );
  }
}
