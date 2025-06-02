import inquirer from 'inquirer';
import pkg from 'pg';
import cTable from 'console.table';

const { Client } = pkg;

let db; // Declare `db` globally

async function ensureDatabaseExists() {
  const client = new Client({
    host: 'localhost',
    user: 'postgres',
    password: 'postgres', // Replace with your PostgreSQL password
    database: 'postgres' // Connect to the default database to check for `company_db`
  });

  await client.connect();

  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'company_db'");
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE company_db');
      console.log('Database `company_db` created successfully!');
    } else {
      console.log('Database `company_db` already exists.');
    }
  } catch (err) {
    console.error('Error ensuring database exists:', err);
  } finally {
    await client.end();
  }
}

// Ensure the database exists before connecting to it
(async () => {
  await ensureDatabaseExists();

  db = new Client({
    host: 'localhost',
    user: 'postgres',
    password: 'postgres', // Replace with your PostgreSQL password
    database: 'company_db'
  });

  db.connect(err => {
    if (err) throw err;
    console.log('Connected to the company_db database.');

    initializeDatabase(db); // Initialize the database schema
    insertSampleData(); // Insert sample data

    startApp(); // Start the application
  });
})();

function initializeDatabase(db) {
  const queries = [
    `CREATE TABLE IF NOT EXISTS department (
      id SERIAL PRIMARY KEY,
      name VARCHAR(30) UNIQUE NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS role (
      id SERIAL PRIMARY KEY,
      title VARCHAR(30) UNIQUE NOT NULL,
      salary DECIMAL NOT NULL,
      department_id INTEGER NOT NULL REFERENCES department(id)
    );`,
    `CREATE TABLE IF NOT EXISTS employee (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(30) NOT NULL,
      last_name VARCHAR(30) NOT NULL,
      role_id INTEGER NOT NULL REFERENCES role(id),
      manager_id INTEGER REFERENCES employee(id)
    );`
  ];

  queries.forEach(query => {
    db.query(query, (err, res) => {
      if (err) throw err;
    });
  });

  console.log('Database initialized successfully!');
}

function insertSampleData() {
  const queries = [
    `INSERT INTO department (name) VALUES ('Engineering'), ('HR'), ('Sales') ON CONFLICT DO NOTHING;`,
    `INSERT INTO role (title, salary, department_id) VALUES 
      ('Software Engineer', 80000, 1),
      ('HR Manager', 60000, 2),
      ('Sales Representative', 50000, 3) ON CONFLICT DO NOTHING;`,
    `INSERT INTO employee (first_name, last_name, role_id, manager_id) VALUES 
      ('John', 'Doe', 1, NULL),
      ('Jane', 'Smith', 2, NULL),
      ('Alice', 'Johnson', 3, NULL) ON CONFLICT DO NOTHING;`
  ];

  queries.forEach(query => {
    db.query(query, (err, res) => {
      if (err) throw err;
    });
  });

  console.log('Sample data inserted successfully!');
}

// Call the function to insert sample data after initializing the database
function startApp() {
  inquirer.prompt({
    name: 'action',
    type: 'list',
    message: 'What would you like to do?',
    choices: [
      'View all departments',
      'View all roles',
      'View all employees',
      'Add a department',
      'Add a role',
      'Add an employee',
      'Update an employee role',
      'Exit'
    ]
  })
  .then(answer => {
    switch (answer.action) {
      case 'View all departments':
        viewAllDepartments();
        break;
      case 'View all roles':
        viewAllRoles();
        break;
      case 'View all employees':
        viewAllEmployees();
        break;
      case 'Add a department':
        addDepartment();
        break;
      case 'Add a role':
        addRole();
        break;
      case 'Add an employee':
        addEmployee();
        break;
      case 'Update an employee role':
        updateEmployeeRole();
        break;
      case 'Exit':
        db.end();
        break;
    }
  });
}

function viewAllDepartments() {
  const query = 'SELECT * FROM department';
  db.query(query, (err, res) => {
    if (err) throw err;
    console.table(res.rows); // Display rows in a readable table format
    startApp();
  });
}

function viewAllRoles() {
  const query = `SELECT role.id, role.title, department.name AS department, role.salary 
                 FROM role 
                 INNER JOIN department ON role.department_id = department.id`;
  db.query(query, (err, res) => {
    if (err) throw err;
    console.table(res.rows); // Display rows in a readable table format
    startApp();
  });
}

function viewAllEmployees() {
  const query = `SELECT employee.id, employee.first_name, employee.last_name, role.title, department.name AS department, role.salary, 
                 CONCAT(manager.first_name, ' ', manager.last_name) AS manager 
                 FROM employee 
                 LEFT JOIN role ON employee.role_id = role.id 
                 LEFT JOIN department ON role.department_id = department.id 
                 LEFT JOIN employee manager ON employee.manager_id = manager.id`;
  db.query(query, (err, res) => {
    if (err) throw err;
    console.table(res.rows); // Display rows in a readable table format
    startApp();
  });
}

function addDepartment() {
  inquirer
    .prompt({
      name: 'name',
      type: 'input',
      message: 'What is the name of the department?'
    })
    .then(answer => {
      const query = 'INSERT INTO department (name) VALUES ($1)';
      db.query(query, [answer.name], (err, res) => {
        if (err) throw err;
        console.log('Department added successfully!');
        startApp();
      });
    });
}

function addRole() {
  inquirer
    .prompt([
      {
        name: 'title',
        type: 'input',
        message: 'What is the title of the role?'
      },
      {
        name: 'salary',
        type: 'input',
        message: 'What is the salary of the role?'
      },
      {
        name: 'department_id',
        type: 'input',
        message: 'What is the department ID for the role?'
      }
    ])
    .then(answer => {
      const validateQuery = 'SELECT id FROM department WHERE id = $1';
      db.query(validateQuery, [answer.department_id], (err, res) => {
        if (err) throw err;
        if (res.rowCount === 0) {
          console.log('Error: The department ID provided does not exist. Please try again.');
          return startApp();
        }

        const query = 'INSERT INTO role (title, salary, department_id) VALUES ($1, $2, $3)';
        db.query(query, [answer.title, answer.salary, answer.department_id], (err, res) => {
          if (err) throw err;
          console.log('Role added successfully!');
          startApp();
        });
      });
    });
}

function addEmployee() {
  inquirer
    .prompt([
      {
        name: 'first_name',
        type: 'input',
        message: "What is the employee's first name?"
      },
      {
        name: 'last_name',
        type: 'input',
        message: "What is the employee's last name?"
      },
      {
        name: 'role_id',
        type: 'input',
        message: "What is the employee's role ID?"
      },
      {
        name: 'manager_id',
        type: 'input',
        message: "What is the employee's manager ID? (Leave blank if none)",
        default: null
      }
    ])
    .then(answer => {
      const query = 'INSERT INTO employee (first_name, last_name, role_id, manager_id) VALUES ($1, $2, $3, $4)';
      db.query(query, [answer.first_name, answer.last_name, answer.role_id, answer.manager_id], (err, res) => {
        if (err) throw err;
        console.log('Employee added successfully!');
        startApp();
      });
    });
}

function updateEmployeeRole() {
  inquirer
    .prompt([
      {
        name: 'employee_id',
        type: 'input',
        message: "What is the ID of the employee whose role you want to update?"
      },
      {
        name: 'role_id',
        type: 'input',
        message: "What is the new role ID for the employee?"
      }
    ])
    .then(answer => {
      const query = 'UPDATE employee SET role_id = $1 WHERE id = $2';
      db.query(query, [answer.role_id, answer.employee_id], (err, res) => {
        if (err) throw err;
        console.log('Employee role updated successfully!');
        startApp();
      });
    });
}
