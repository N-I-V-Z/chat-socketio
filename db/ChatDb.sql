create database ChatDb
go
use ChatDb
go
create table Chat(
	chatRoom int primary key
);
go
create table Users(
	userId int primary key identity,
	userName nvarchar(255) not null,
	password varchar(255) not null,
);
go
create table Message(
	messageId int primary key identity,
	time datetime default getdate(),
	userId int foreign key references Users(userId),
	chatRoom int foreign key references Chat(chatRoom)
);