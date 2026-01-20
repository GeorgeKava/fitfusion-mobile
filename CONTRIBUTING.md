# Contributing to FitFusion AI

Thank you for your interest in contributing to FitFusion AI! This document provides guidelines for contributing to the project.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/FitFusion-AI-React.git
   cd FitFusion-AI-React
   ```

2. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   cp .env.example .env
   # Configure your Azure credentials in .env
   python app.py
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```

## Contributing Guidelines

### Code Style
- Follow PEP 8 for Python code
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and single-purpose

### Pull Request Process
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test your changes thoroughly
5. Commit your changes: `git commit -m "Add your feature"`
6. Push to your fork: `git push origin feature/your-feature-name`
7. Open a Pull Request

### Issue Reporting
- Use the issue tracker for bug reports and feature requests
- Provide detailed information about the problem
- Include steps to reproduce for bugs
- Suggest solutions when possible

### Testing
- Test all new features before submitting
- Ensure the application runs without errors
- Test voice chat functionality if making related changes
- Verify food recommendations work correctly

## Areas for Contribution

### High Priority
- UI/UX improvements
- Performance optimizations
- Error handling enhancements
- Documentation improvements

### Feature Ideas
- Additional exercise types
- Nutrition tracking
- Progress analytics
- Mobile responsiveness
- Multi-language support

### Technical Debt
- Code refactoring
- Test coverage improvement
- Dependency updates
- Security enhancements

## Getting Help

- Join discussions in the Issues section
- Read the README.md for setup instructions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
