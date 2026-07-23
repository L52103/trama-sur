using Microsoft.EntityFrameworkCore;
using Store.Domain.Catalog;
using Store.Domain.Commerce;
using Store.Domain.Common;

namespace Store.Infrastructure.Persistence;

public static class StoreDbContextSeed
{
    public static async Task SeedAsync(StoreDbContext db, CancellationToken cancellationToken)
    {
        if (await db.Products.AnyAsync(cancellationToken)) return;

        var categories = new[]
        {
            new Category("Impermeables", "impermeables"), new Category("Térmicos", "termicos"),
            new Category("Movimiento", "movimiento"), new Category("Viaje", "viaje"),
            new Category("Urbano", "urbano"), new Category("Outdoor", "outdoor"),
            new Category("Trabajo", "trabajo"), new Category("Protección solar", "proteccion-solar")
        };
        db.Categories.AddRange(categories);

        var attributes = new[]
        {
            new FunctionalFeature("Impermeabilidad", "impermeable", "mm", "Nivel de resistencia a columna de agua."),
            new FunctionalFeature("Transpirabilidad", "transpirable", null, "Ayuda a evacuar humedad durante el movimiento."),
            new FunctionalFeature("Secado rápido", "secado-rapido", null, "Tejido diseñado para secar con rapidez."),
            new FunctionalFeature("Protección UV", "proteccion-uv", "UPF", "Protección textil frente a radiación ultravioleta."),
            new FunctionalFeature("Cortaviento", "cortaviento", null, "Construcción que reduce el paso del viento."),
            new FunctionalFeature("Reflectante", "reflectante", null, "Detalles que mejoran la visibilidad con poca luz."),
            new FunctionalFeature("Elasticidad", "elasticidad", null, "Tejido con libertad de movimiento."),
            new FunctionalFeature("Abrigo", "abrigo", null, "Aislamiento para temperaturas bajas.")
        };
        db.FunctionalAttributes.AddRange(attributes);

        var warehouse = new Warehouse("Bodega principal", "SCL-01");
        db.Warehouses.Add(warehouse);

        var catalog = new (string Name, string Slug, int Category, long Price, string Description, string[] Colors, string FunctionValue)[]
        {
            // 1-20 (Originales)
            ("Chaqueta Tormenta 3L", "chaqueta-tormenta-3l", 0, 129990, "Protección de tres capas para lluvia intensa y trayectos diarios.", ["Grafito", "Bosque"], "15.000"),
            ("Parka Austral", "parka-austral", 0, 159990, "Parka impermeable larga con capucha ajustable y abrigo ligero.", ["Negro", "Arena"], "12.000"),
            ("Chaqueta Brisa", "chaqueta-brisa", 0, 89990, "Capa liviana y compacta para lluvia intermitente.", ["Azul noche", "Oliva"], "10.000"),
            ("Poncho Cordillera", "poncho-cordillera", 0, 69990, "Cobertura amplia y fácil de guardar para cambios de clima.", ["Negro", "Musgo"], "8.000"),
            ("Polar Térmico Grid", "polar-termico-grid", 1, 74990, "Capa intermedia respirable con estructura térmica cuadriculada.", ["Bosque", "Negro"], "Medio"),
            ("Chaqueta Insulada Sur", "chaqueta-insulada-sur", 1, 119990, "Abrigo sintético liviano para uso urbano y de viaje.", ["Grafito", "Piedra"], "Alto"),
            ("Primera Capa Merino", "primera-capa-merino", 1, 54990, "Mezcla merino suave que regula temperatura y humedad.", ["Negro", "Vino"], "Medio"),
            ("Polerón Medio Cierre", "poleron-medio-cierre", 1, 64990, "Polerón técnico de media cremallera para capas versátiles.", ["Negro", "Azul noche"], "Medio"),
            ("Pantalón Movimiento", "pantalon-movimiento", 2, 79990, "Pantalón elástico de secado rápido con corte limpio.", ["Grafito", "Oliva"], "4 vías"),
            ("Cortaviento Ritmo", "cortaviento-ritmo", 2, 69990, "Cortaviento respirable para caminatas, bicicleta y traslado.", ["Bosque", "Negro"], "Sí"),
            ("Polera UV Activa", "polera-uv-activa", 2, 39990, "Polera técnica suave con protección UV para movimiento diario.", ["Blanco", "Grafito"], "50+"),
            ("Short Ruta", "short-ruta", 2, 44990, "Short elástico y liviano con bolsillos seguros.", ["Negro", "Arcilla"], "4 vías"),
            ("Pantalón Travel Light", "pantalon-travel-light", 3, 89990, "Pantalón compacto, resistente a arrugas y de secado rápido.", ["Azul noche", "Piedra"], "Rápido"),
            ("Sobrecamisa Tránsito", "sobrecamisa-transito", 3, 84990, "Sobrecamisa técnica con bolsillos discretos para viajar.", ["Bosque", "Arena"], "Ligero"),
            ("Mochila Viaje 28L", "mochila-viaje-28l", 3, 79990, "Mochila funcional con apertura completa y funda para notebook.", ["Negro"], "28 L"),
            ("Chaleco Urbano", "chaleco-urbano", 4, 69990, "Capa utilitaria liviana para combinar durante todo el año.", ["Grafito", "Bosque"], "Ligero"),
            ("Abrigo Modular", "abrigo-modular", 4, 179990, "Abrigo sobrio con interior desmontable para clima variable.", ["Negro", "Piedra"], "Modular"),
            ("Camisa Técnica", "camisa-tecnica", 6, 59990, "Camisa respirable de apariencia limpia para jornadas activas.", ["Blanco", "Azul cielo"], "Rápido"),
            ("Pantalón Jornada", "pantalon-jornada", 6, 84990, "Pantalón durable y elástico para trabajo en movimiento.", ["Grafito", "Azul noche"], "4 vías"),
            ("Polera Solar UPF50+", "polera-solar-upf50", 7, 42990, "Polera de manga larga con cobertura UV para exteriores.", ["Niebla", "Bosque"], "50+"),
            // 21-40 (Variantes Pro)
            ("Chaqueta Tormenta 3L Pro", "chaqueta-tormenta-3l-pro", 0, 149990, "Versión avanzada con mejores sellos de agua.", ["Negro", "Musgo"], "20.000"),
            ("Parka Austral Expedition", "parka-austral-expedition", 0, 189990, "Mayor retención de calor para expediciones.", ["Vino", "Grafito"], "15.000"),
            ("Chaqueta Brisa Ligera", "chaqueta-brisa-ligera", 0, 99990, "Aún más compactable y ligera.", ["Azul cielo", "Arena"], "12.000"),
            ("Poncho Cordillera X", "poncho-cordillera-x", 0, 79990, "Cobertura ultra resistente para trekking.", ["Oliva", "Piedra"], "10.000"),
            ("Polar Térmico Grid Pro", "polar-termico-grid-pro", 1, 84990, "Mayor densidad para frío extremo.", ["Negro", "Azul noche"], "Alto"),
            ("Chaqueta Insulada Norte", "chaqueta-insulada-norte", 1, 129990, "Variante con aislamiento reciclado superior.", ["Grafito", "Vino"], "Alto"),
            ("Primera Capa Merino Gruesa", "primera-capa-merino-gruesa", 1, 64990, "Mayor grosor para control térmico invernal.", ["Negro", "Bosque"], "Alto"),
            ("Polerón Cuello Alto", "poleron-cuello-alto", 1, 74990, "Mayor cobertura en la zona del cuello.", ["Gris", "Arena"], "Medio"),
            ("Pantalón Movimiento Flex", "pantalon-movimiento-flex", 2, 89990, "Construcción articulada en rodillas.", ["Grafito", "Azul noche"], "4 vías"),
            ("Cortaviento Ritmo Ultra", "cortaviento-ritmo-ultra", 2, 79990, "Detalles reflectantes 360 grados.", ["Lima", "Negro"], "Sí"),
            ("Polera UV Activa V2", "polera-uv-activa-v2", 2, 44990, "Mejor respirabilidad en zonas clave.", ["Blanco", "Negro"], "50+"),
            ("Short Ruta Trail", "short-ruta-trail", 2, 54990, "Malla interior integrada para trail running.", ["Negro", "Oliva"], "4 vías"),
            ("Pantalón Travel Heavy", "pantalon-travel-heavy", 3, 99990, "Mayor resistencia a la abrasión.", ["Azul noche", "Piedra"], "Rápido"),
            ("Sobrecamisa Tránsito Lino", "sobrecamisa-transito-lino", 3, 94990, "Mezcla técnica para climas cálidos.", ["Arena", "Blanco"], "Ligero"),
            ("Mochila Viaje 40L", "mochila-viaje-40l", 3, 99990, "Capacidad extendida para viajes largos.", ["Negro", "Bosque"], "40 L"),
            ("Chaleco Urbano Acolchado", "chaleco-urbano-acolchado", 4, 79990, "Mayor retención térmica en el torso.", ["Negro", "Azul noche"], "Medio"),
            ("Abrigo Modular Largo", "abrigo-modular-largo", 4, 199990, "Corte bajo la rodilla para máxima cobertura.", ["Negro", "Grafito"], "Modular"),
            ("Camisa Técnica Manga Corta", "camisa-tecnica-mc", 6, 49990, "Versión de verano con ventilación trasera.", ["Celeste", "Gris"], "Rápido"),
            ("Pantalón Jornada Cargo", "pantalon-jornada-cargo", 6, 94990, "Bolsillos adicionales de carga rápida.", ["Oliva", "Negro"], "4 vías"),
            ("Polera Solar UPF50+ Capucha", "polera-solar-upf50-capucha", 7, 52990, "Incluye capucha para protección de cuello y cabeza.", ["Niebla", "Blanco"], "50+"),
            // 41-50 (Prendas adicionales)
            ("Gorro Térmico Cumbre", "gorro-termico-cumbre", 1, 24990, "Retención de calor para la cabeza en entornos fríos.", ["Negro", "Grafito"], "Alto"),
            ("Calcetines Trekking Merino", "calcetines-trekking-merino", 1, 19990, "Acolchado zonal y control de humedad.", ["Gris", "Oliva"], "Medio"),
            ("Guantes Cortaviento", "guantes-cortaviento", 2, 29990, "Compatibles con pantallas táctiles.", ["Negro"], "Sí"),
            ("Cinturón de Viaje", "cinturon-viaje", 3, 159990, "Cinturón flexible sin partes metálicas.", ["Negro", "Arena"], "Ligero"),
            ("Chaqueta Softshell", "chaqueta-softshell", 0, 109990, "Resistente al agua y muy flexible para escalada.", ["Bosque", "Vino"], "5.000"),
            ("Pantalón Corto Híbrido", "pantalon-corto-hibrido", 2, 49990, "Apto para el agua y secado ultra rápido.", ["Azul noche", "Negro"], "Rápido"),
            ("Polera Manga Larga Base", "polera-ml-base", 1, 34990, "Uso diario con tratamiento anti olor.", ["Blanco", "Grafito"], "Medio"),
            ("Mochila Ligera 15L", "mochila-ligera-15l", 3, 49990, "Día a día, empacable en su propio bolsillo.", ["Negro", "Azul"], "15 L"),
            ("Pantalón Impermeable", "pantalon-impermeable", 0, 89990, "Cubre pantalón de 2.5 capas.", ["Negro"], "10.000"),
            ("Bufanda Tubular", "bufanda-tubular", 7, 14990, "Protección solar y contra el polvo.", ["Arena", "Niebla"], "50+")
        };

        var products = new List<Product>();
        var inventory = new List<InventoryItem>();
        for (var productIndex = 0; productIndex < catalog.Length; productIndex++)
        {
            var data = catalog[productIndex];
            var product = new Product(data.Name, data.Slug, categories[data.Category].Id, data.Description, data.Price);
            var audience = (productIndex % 2 == 0) ? "Hombre" : "Mujer";
            product.SetDetails($"{data.Description} Diseñada en Chile como una prenda funcional, versátil y fácil de combinar.", "Composición técnica declarada en la etiqueta de cada variante. Proveedor pendiente de confirmación comercial.", "Lavar con colores similares y seguir la etiqueta. No usar suavizante en membranas impermeables.", audience, $"{data.Name} | TRAMA SUR", $"Compra {data.Name.ToLowerInvariant()} con despacho configurable en Chile. Precio en CLP e IVA incluido.");
            foreach (var color in data.Colors)
            {
                foreach (var size in new[] { "XS", "S", "M", "L", "XL" })
                {
                    var skuColor = color.Replace(" ", string.Empty, StringComparison.Ordinal).ToUpperInvariant()[..Math.Min(3, color.Replace(" ", string.Empty, StringComparison.Ordinal).Length)];
                    var variant = new ProductVariant(product.Id, $"TS-{productIndex + 1:000}-{skuColor}-{size}", color, size);
                    product.AddVariant(variant);
                    inventory.Add(new InventoryItem(warehouse.Id, variant.Id, 4 + ((productIndex + size.Length + color.Length) % 12)));
                }
            }
            var imageUrl = (productIndex % 10) switch { 
                0 => "/assets/images/chaqueta-commuter.png", 
                1 => "/assets/images/sobrecamisa-bosque.png", 
                2 => "/assets/images/polera-organica.png", 
                3 => "/assets/images/pantalon-travel.png",
                4 => "/assets/images/parka_mujer_1784042866695.jpg",
                5 => "/assets/images/chaqueta_hombre_1784042876930.jpg",
                6 => "/assets/images/mochila_viaje_1784042886150.jpg",
                7 => "/assets/images/pantalon_hombre_1784042894908.jpg",
                8 => "/assets/images/polera_mujer_1784042904196.jpg",
                _ => "/assets/images/cortaviento_unisex_1784042913487.jpg" 
            };
            product.AddImage(new ProductImage(product.Id, imageUrl, $"{data.Name} en fotografía de catálogo", 0, true, 1200, 1600));
            var attribute = attributes[data.Category switch { 0 => 0, 1 => 7, 2 => 6, 7 => 3, _ => 2 }];
            product.AddFunctionalAttribute(new ProductFunctionalFeature(product.Id, attribute.Id, data.FunctionValue, 0));
            product.Publish(DateTimeOffset.UtcNow.AddDays(-catalog.Length + productIndex));
            products.Add(product);
        }

        db.Products.AddRange(products);
        db.InventoryItems.AddRange(inventory);
        await db.SaveChangesAsync(cancellationToken);
    }
}
