-- Merkl · catálogos iniciales (de la plantilla de carga)
insert into empresas (codigo, nombre, moneda) values
 ('CGT','Celasa Guatemala','GTQ'),('CSV','Celasa El Salvador','USD'),('ELE','Electroma','GTQ'),
 ('AME','American','GTQ'),('LOG','Logistik','GTQ');

insert into medios (nombre, plataforma, fuente, moneda_gasto) values
 ('Meta','meta','porter','USD'),('Google Ads','google_ads','porter','USD'),('YouTube','google_ads','porter','USD'),
 ('TikTok','tiktok','porter','USD'),('LinkedIn','linkedin','porter','USD'),('Basis','basis','csv','USD'),
 ('Claro','claro','csv','GTQ'),('iSoft','isoft','csv','GTQ'),('Mailjet','mailjet','csv','GTQ');

insert into objetivos (nombre, tipo_costo, resultado, columna_resultado) values
 ('Alcance','por_mil','Personas alcanzadas (únicas)','alcance_unico'),
 ('Alcance geolocalizado','por_mil','Personas alcanzadas (únicas)','alcance_unico'),
 ('Alcance / Video view','por_mil','Personas alcanzadas (únicas)','alcance_unico'),
 ('Bumper / Instream','por_mil','Personas alcanzadas (únicas)','alcance_unico'),
 ('Display','por_mil','Personas alcanzadas (únicas)','alcance_unico'),
 ('Display programático','por_mil','Personas alcanzadas (únicas)',null),
 ('Demand Gen · Alcance','por_mil','Personas alcanzadas (únicas)','alcance_unico'),
 ('SMS geolocalizado','por_mil','SMS entregados',null),
 ('Interacción','por_unidad','Interacciones','interacciones'),
 ('Search · Clics','por_unidad','Clics','clics'),
 ('Demand Gen · Tráfico','por_unidad','Clics','clics'),
 ('Tráfico','por_unidad','Clics al sitio','clics'),
 ('Mensajes WhatsApp','por_unidad','Conversaciones','mensajes'),
 ('Ventas','por_unidad','Compras','compras'),
 ('Lead Forms','por_unidad','Leads','leads'),
 ('WhatsApp masivo','por_unidad','Mensajes enviados',null),
 ('SMS','por_unidad','SMS enviados',null),
 ('Mailing','sin_costo','Correos enviados',null);

insert into actividades (nombre, tipo) values
 ('Mantenimiento','Siempre activa'),('Apoyo CC','Siempre activa'),('Promo CC','Oferta'),
 ('Electro Independencia','Oferta principal'),('Electro Days','Oferta'),('Festival de la Iluminación','Oferta principal'),
 ('Talento Humano','Extra'),('Envío Insysa','Solicitud extra'),('Leads B2B','B2B'),('Capacitación','Evento');

insert into partidas (nombre) values
 ('Meta FB e IG'),('Google'),('YouTube'),('LinkedIn'),('Programatic'),('Claro SMS'),('Whatsapp Isoft'),('Tik Tok'),
 ('Leads B2B'),('Tráfico a tiendas Geolocalizado'),('Mundial'),('Extras'),('Sin costo');
