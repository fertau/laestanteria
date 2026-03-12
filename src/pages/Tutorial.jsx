import { Link } from 'react-router-dom';
import { BookOpen, Users, Tablet, KeyRound, Upload, PartyPopper } from 'lucide-react';

export default function Tutorial() {
  return (
    <div className="page">
      <h1 className="page-title">Como usar La Estanteria</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28, marginTop: -12, lineHeight: 1.6 }}>
        Una guia paso a paso para configurar todo y empezar a compartir libros con tus amigos.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Step 1: Welcome */}
        <TutorialStep number={1} title="Bienvenida" icon={BookOpen}>
          <p>
            <strong>La Estanteria</strong> es una biblioteca compartida entre amigos.
            Podes agregar tus libros digitales (EPUB), ver que estan leyendo tus amigos,
            y enviarte libros directamente a tu Kindle.
          </p>
          <p style={{ marginTop: 8 }}>
            Para aprovechar todo, necesitas configurar algunas cosas. Esta guia te lleva paso a paso.
          </p>
        </TutorialStep>

        {/* Step 2: Follow people */}
        <TutorialStep number={2} title="Seguir personas" icon={Users}>
          <p>
            Anda a <Link to="/people" style={{ color: 'var(--accent)', fontWeight: 600 }}>Personas</Link> y
            busca a tus amigos en el <strong>Directorio</strong>. Toca <strong>"Seguir"</strong> para conectarte.
          </p>
          <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: 13 }}>
            <strong style={{ color: 'var(--accent)' }}>Hay 2 niveles de acceso:</strong>
            <ul style={{ margin: '8px 0 0 16px', lineHeight: 1.8 }}>
              <li><strong>Actividad</strong> — ves cuando agregan o leen libros</li>
              <li><strong>Biblioteca</strong> — ademas podes pedirles libros a tu Kindle</li>
            </ul>
            <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: 12 }}>
              Cada persona elige que nivel de acceso darte. Si tiene modo cerrado, primero te tiene que aceptar.
            </p>
          </div>
        </TutorialStep>

        {/* Step 3: Kindle setup */}
        <TutorialStep number={3} title="Configurar tu Kindle" icon={Tablet}>
          <p>
            Para recibir libros en tu Kindle, necesitas 2 cosas: tu email de Kindle y autorizar a La Estanteria para enviarte libros.
          </p>

          <StepList steps={[
            {
              title: 'Encontra tu email de Kindle',
              content: (
                <>
                  Anda a{' '}
                  <a href="https://www.amazon.com/mycd" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    amazon.com/mycd
                  </a>
                  {' '}→ <strong>Devices</strong> → selecciona tu Kindle o la app Kindle.
                  Ahi vas a ver tu email, algo como <code style={{ color: 'var(--accent)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>nombre_XXXXX@kindle.com</code>
                </>
              ),
            },
            {
              title: 'Autoriza el remitente',
              content: (
                <>
                  En la misma pagina, anda a <strong>Preferences</strong> → <strong>Personal Document Settings</strong> →
                  <strong> Approved Personal Document E-mail List</strong>.
                  Agrega: <code style={{ color: 'var(--accent)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>ticher@gmail.com</code>
                </>
              ),
            },
            {
              title: 'Guarda tu email en La Estanteria',
              content: (
                <>
                  Anda a tu{' '}
                  <Link to={`/profile/me`} style={{ color: 'var(--accent)', fontWeight: 600 }}>Perfil</Link>
                  {' '}→ seccion <strong>Configuracion Kindle</strong> y pega tu email @kindle.com.
                  Listo, ahora podes recibir libros!
                </>
              ),
            },
          ]} />
        </TutorialStep>

        {/* Step 4: Gmail App Password */}
        <TutorialStep number={4} title="Gmail App Password (opcional)" icon={KeyRound}>
          <p>
            Esto es solo si queres <strong>enviar libros desde tu propia cuenta de Gmail</strong>.
            Si solo queres recibir, podes saltear este paso.
          </p>

          <StepList steps={[
            {
              title: 'Activa la verificacion en 2 pasos',
              content: (
                <>
                  Anda a{' '}
                  <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    myaccount.google.com
                  </a>
                  {' '}→ <strong>Seguridad</strong> → <strong>Verificacion en 2 pasos</strong>. Seguí los pasos para activarla.
                </>
              ),
            },
            {
              title: 'Genera una contrasena de aplicacion',
              content: (
                <>
                  En <strong>Seguridad</strong> → busca <strong>Contrasenas de aplicaciones</strong> (App passwords).
                  Crea una nueva con el nombre "La Estanteria". Google te va a dar una contrasena de 16 caracteres.
                </>
              ),
            },
            {
              title: 'Guarda la contrasena',
              content: 'Copia la contrasena generada. La vas a necesitar si configuras el envio de emails desde tu cuenta.',
            },
          ]} />
        </TutorialStep>

        {/* Step 5: Upload first book */}
        <TutorialStep number={5} title="Agrega tu primer libro" icon={Upload}>
          <p>
            Anda a{' '}
            <Link to="/catalog" style={{ color: 'var(--accent)', fontWeight: 600 }}>Catalogo</Link>
            {' '}y toca el boton de agregar. Podes agregar archivos <strong>EPUB</strong> desde tu computadora o celular.
          </p>
          <p style={{ marginTop: 8 }}>
            La app va a buscar automaticamente la portada y los datos del libro.
            Si no los encuentra, podes editarlos manualmente.
          </p>
        </TutorialStep>

        {/* Step 6: Done */}
        <TutorialStep number={6} title="Listo!" icon={PartyPopper}>
          <p>
            Ya estas configurado. Ahora podes explorar lo que leen tus amigos,
            compartir tus libros favoritos, y armar colecciones.
          </p>
          <div style={{ marginTop: 16 }}>
            <Link to="/" className="btn btn-primary">
              Ir al inicio
            </Link>
          </div>
        </TutorialStep>

      </div>
    </div>
  );
}

function TutorialStep({ number, title, icon: Icon, children }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 20px 24px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className="badge-gold" style={{ fontSize: 12, padding: '4px 10px' }}>{number}</span>
        <Icon size={20} style={{ color: 'var(--accent)' }} />
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          margin: 0,
        }}>
          {title}
        </h2>
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

function StepList({ steps }) {
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map((step, i) => (
        <div key={i} style={{
          padding: '12px 16px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius)',
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--text)' }}>
            {String.fromCharCode(97 + i)}) {step.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {step.content}
          </div>
        </div>
      ))}
    </div>
  );
}
