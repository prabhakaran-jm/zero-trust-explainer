# Contributing to Zero-Trust Explainer

Thank you for your interest in contributing to Zero-Trust Explainer!

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Python 3.11+
- Node.js 20+
- Terraform 1.5+
- GCP account (for testing)

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/prabhakaran-jm/zero-trust-explainer.git
cd zero-trust-explainer
```

2. Set up backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your GCP credentials
```

3. Set up frontend:
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env to point to your backend
```

4. Run with Docker Compose:
```bash
docker-compose up --build
```

### Code Style

#### Python
- Follow PEP 8
- Use type hints where possible
- Add docstrings to functions and classes
- Run `black` for formatting
- Run `pylint` for linting

#### JavaScript/React
- Use ESLint and Prettier
- Follow React best practices
- Use functional components with hooks
- Keep components small and focused

#### Terraform
- Run `terraform fmt` before committing
- Use meaningful resource names
- Add comments for complex configurations

### Testing

#### Backend Tests
```bash
cd backend
pytest
```

#### Frontend Tests
```bash
cd frontend
npm test
```

#### Integration Tests
```bash
./scripts/run-integration-tests.sh
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests and linters
5. Commit with clear messages: `git commit -m "Add feature X"`
6. Push to your fork: `git push origin feature/my-feature`
7. Create a Pull Request

### Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Include tests for new features
- Update documentation as needed
- Ensure all CI checks pass
- Keep PRs focused and manageable in size

### Code Review Process

1. At least one maintainer must approve
2. All CI checks must pass
3. No unresolved conversations
4. Branch must be up to date with main

### Reporting Issues

When reporting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, versions, etc.)
- Relevant logs or error messages

### Security Issues

For security vulnerabilities, please email security@example.com instead of opening a public issue.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
