IF EXISTS (SELECT * FROM sys.databases WHERE name = 'ChatDb')
BEGIN
    DROP DATABASE ChatDb;
END
go
create database ChatDb
go
use ChatDb
go
create table Users(
	userId int primary key identity,
	userName nvarchar(255) not null,
	password varchar(255) not null,
);
go
CREATE TABLE Message (
  MessageId INT PRIMARY KEY IDENTITY(1,1),
  SenderId INT NOT NULL,
  ReceiverId INT NOT NULL,
  MessageText TEXT NOT NULL,
  Timestamp DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (SenderId) REFERENCES Users(UserId),
  FOREIGN KEY (ReceiverId) REFERENCES Users(UserId)
);
