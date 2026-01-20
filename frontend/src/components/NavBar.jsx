import React from 'react';
import { Link } from 'react-router-dom';

function NavBar({ user, onLogout }) {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center" to="/">
          <img 
            src="/logo.png" 
            alt="FitFusion AI Logo" 
            className="fitfusion-logo me-2"
          />
          FitFusion AI
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {user && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/">
                    <i className="fas fa-tachometer-alt me-1"></i>
                    Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/fitness-advisor">
                    <i className="fas fa-dumbbell me-1"></i>
                    AI Advisor
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/weekly-plan">
                    <i className="fas fa-calendar-week me-1"></i>
                    Weekly Plan
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/progress">
                    <i className="fas fa-chart-line me-1"></i>
                    Progress
                  </Link>
                </li>
                {/* Voice Chat DISABLED to save tokens */}
                {/* <li className="nav-item">
                  <Link className="nav-link" to="/voice-chat">
                    <i className="fas fa-microphone me-1"></i>
                    Voice Chat
                  </Link>
                </li> */}
                <li className="nav-item dropdown">
                  <a
                    className="nav-link dropdown-toggle"
                    href="#"
                    id="nutritionDropdown"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <i className="fas fa-utensils me-1"></i>
                    Nutrition
                  </a>
                  <ul className="dropdown-menu" aria-labelledby="nutritionDropdown">
                    <li>
                      <Link className="dropdown-item" to="/food-recommendations">
                        <i className="fas fa-apple-alt me-2"></i>
                        Food Recommendations
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/identify-food">
                        <i className="fas fa-camera me-2"></i>
                        Identify Food
                      </Link>
                    </li>
                  </ul>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/profile">
                    <i className="fas fa-user me-1"></i>
                    Profile
                  </Link>
                </li>
              </>
            )}
          </ul>
          <ul className="navbar-nav">
            {user ? (
              <li className="nav-item dropdown">
                <a
                  className="nav-link dropdown-toggle"
                  href="#"
                  id="navbarDropdown"
                  role="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <i className="fas fa-user-circle me-1"></i>
                  {user.email}
                </a>
                <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
                  <li>
                    <Link className="dropdown-item" to="/profile">
                      <i className="fas fa-user me-2"></i>
                      Profile
                    </Link>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={onLogout}
                    >
                      <i className="fas fa-sign-out-alt me-2"></i>
                      Logout
                    </button>
                  </li>
                </ul>
              </li>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">
                    <i className="fas fa-sign-in-alt me-1"></i>
                    Login
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/register">
                    <i className="fas fa-user-plus me-1"></i>
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;