import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="layout-footer">
      <div className="footer-content">
        <div className="footer-logo">
          <img src="/logo-icon-only.png" alt="My Hive" className="footer-logo-img" />
        </div>
        <div className="footer-text">
          <p className="footer-copyright">© {currentYear} My Hive</p>
          <p className="footer-built-by">Built by Newman Solutions</p>
        </div>
      </div>
    </footer>
  );
}
