var mongodb = require('./db'),
	markdown = require('markdown').markdown;

function Post(name, head, title, tags, post) {
	this.name = name;
	this.head = head;
	this.title = title;
	this.tags = tags;
	this.post = post;
}

module.exports = Post;

// 存储一篇文章和相关信息
Post.prototype.save = function(callback) {
	var date = new Date();

	// 存储时间格式， 方便以后扩展
	var time = {
		date: date,
		year: date.getFullYear(),
		month: date.getFullYear() + '-' + (date.getMonth() + 1),
		day: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate(),
		minute: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes())
	}

	// 要存入数据库的文档
	var post = {
		name: this.name,
		head: this.head,
		time: time,
		title: this.title,
		tags: this.tags,
		post: this.post,
		comments: [],
		reprint_info: {},
		pv: 0
	}

	// 打开数据库
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}

		// 读取post集合
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}
			// 将文档插入posts集合
			collection.insert(post, {
				safe: true
			}, function(err) {
				mongodb.close();
				if(err) {
					return callback(err) // 失败，返回err
				}
				callback(null); // 返回err为null
			})
		})
	})
}

// 读取文章和其他相关信息
// 获取10篇
Post.getTen = function(name, page, callback) {
	// 打开数据库
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}
		// 读取post集合
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}

			var query = {};
			if(name) {
				query.name = name;
			}

			// 根据query对象查询文章
			// collection.find(query).sort({
			// 	time: -1
			// }).toArray(function(err, docs) {
			// 	mongodb.close();
			// 	if(err) {
			// 		return callback(err); //失败
			// 	}
			// 	docs.forEach(function(doc) {
			// 		doc.post = markdown.toHTML(doc.post);
			// 	})
			// 	callback(null, docs); //成功
			// })

			// 使用count返回特定查询文档数total
			collection.count(query, function(err, total) {
				// 根据query对象查询，并跳过前(page-1)*10个结果，返回之后10个结果
				collection.find(query, {
					skip: (page-1) * 10,
					limit: 10
				}).sort({
					time: -1
				}).toArray(function(err, docs){
					mongodb.close();
					if(err) {
						return callback(err);
					}

					// 解析markdown为html
					docs.forEach(function(doc) {
						doc.post = markdown.toHTML(doc.post);
					})
					callback(null, docs, total);
				})
			})
		})
	})
}

Post.getOne = function(name, day, title, callback) {
	// 打开数据库
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}
		// 读取post集合
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}
			// 根据用户名，发表日期，和文章名进行查询
			collection.findOne({
				"name": name,
				"time.day": day,
				"title": title
			}, function(err, doc) {
				if(err) {
					mongodb.close();
					return callback(err);
				}
				if(doc) {
					// 每访问一次，pv值加1
					collection.update({
						"name": name,
						"time.day": day,
						"title": title
					}, {
						$inc: {"pv": 1}
					}, function(err) {
						mongodb.close();
						if(err) {
							return callback(err);
						}
					})
					// 解析markdown 为html
					// doc.post = markdown.toHTML(doc.post);
					doc.post = markdown.toHTML(doc.post);
					doc.comments.forEach(function(comment) {
						comment.content = markdown.toHTML(comment.content);
					})
				}
				callback(null, doc); // 返回查询到的一篇文章
			})
		})
	})
} 

// 返回原始发表的内容
Post.edit = function(name, day, title, callback) {
	// 打开数据库
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}
		// 读取post集合
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}
			// 根据用户名，发表日期及文章名进行查询
			collection.findOne({
				"name": name,
				"time.day": day,
				"title": title
			}, function(err, doc) {
				mongodb.close();
				if(err) {
					return callback(err);
				}
				callback(null, doc); // 返回查询的一篇文章
			})
		})
	})
}

// 更新一篇文章及相关信息
Post.update = function(name, day, title, post, callback) {
	// 打开数据库
	mongodb.open(function(err, db) {
		if(err){
			return callback(err);
		}
		// 读取post集合
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}
			// 更新文章内容
			collection.update({
				"name": name,
				"time.day": day,
				"title": title
			}, {
				$set: {post: post}
			}, function(err) {
				mongodb.close();
				if(err){
					return callback(err);
				}
				callback(null);
			})
		})

	})
}

// 删除一篇文章
Post.remove = function(name, day, title, callback) {
	// 打开数据库
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}

		// 读取post集合
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}

			// 查询要删除的文档
			collection.findOne({
				"name": name,
				"time.day": day,
				"title": title
			}, function(err, doc) {
				if(err){
					mongodb.close();
					return callback(err);
				}
				//如果有reprint_from 那么该文章就是转载而来， 先保存下来reprint_from
				var reprint_from = "";
				if(doc.reprint_info.reprint_from) {
					reprint_from = doc.reprint_info.reprint_from;
				}
				if(reprint_from != ""){
					// 更新原来文章所在文档的reprint_to
					collection.update({
						"name": reprint_from.name,
						"time.day": reprint_from.day,
						"title": reprint_from.title
					}, {
						$pull: {
							"reprint_info.reprint_to": {
								"name": name,
								"day": day,
								"title": title
							}
						}
					}, function(err){
						if(err) {
							mongodb.close();
							return callback(err);
						}
					})
				} 
				// 根据用户名，日期，标题查找并删除一篇文章
				collection.remove({
					"name": name,
					"time.day": day,
					"title": title
				}, {
					w: 1
				}, function(err) {
					mongodb.close();
					if(err) {
						return callback(err);
					}
					callback(null);
				})
			})
		})
	})
}

Post.getArchive = function(callback) {
	// 打开数据库
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}
		// 读取posts集合
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}

			// 返回只包含name time title 属性的文档组成的存档数组
			collection.find({}, {
				"name": 1,
				"time": 1,
				"title": 1
			}).sort({
				time: -1
			}).toArray(function(err, docs) {
				mongodb.close();
				if(err) {
					return callback(err);
				}
				callback(null, docs);
			})
		})
	})
}

Post.getTags = function(callback) {
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}

			// distinct 用来找出给定键下的所有不同值
			collection.distinct('tags', function(err, docs) {
				mongodb.close();
				if(err) {
					return callback(err);
				}
				callback(null, docs);
			})
		})
	})
}

Post.getTag = function(tag, callback) {
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}
			collection.find({
				"tags": tag
			}, {
				"name": 1,
				"time": 1,
				"title": 1
			}).sort({
				time: -1
			}).toArray(function(err, docs) {
				mongodb.close();
				if(err) {
					return callback(err);
				}
				callback(null, docs);
			})
		})
	})
}

Post.search = function(keyword, callback) {
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}
			var pattern = new RegExp('^.*' + keyword + '.*$', "i");
			collection.find({
				'title': pattern
			}, {
				"name": 1,
				"time": 1,
				"title": 1
			}).sort({
				time: -1
			}).toArray(function(err, docs) {
				mongodb.close();
				if(err) {
					return callback(err);
				}
				callback(null, docs);
			})
		})
	})
}

// 转载一篇文章
Post.reprint = function(reprint_from, reprint_to, callback) {
	mongodb.open(function(err, db) {
		if(err) {
			return callback(err);
		}
		db.collection('posts', function(err, collection) {
			if(err) {
				mongodb.close();
				return callback(err);
			}
			// 找到被转载的文章原文档
			collection.findOne({
				"name": reprint_from.name,
				"time.day": reprint_from.day,
				"title": reprint_from.title
			}, function(err, doc) {
				if(err) {
					mongodb.close();
					return callback(err);
				}

				var date = new Date();
				var time = {
					date: date,
					year: date.getFullYear(),
					month: date.getFullYear() + '-' + (date.getMonth() + 1),
					day: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate(),
					minute: date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) 
				}

				delete doc._id; // 删掉原来的id
				doc.name = reprint_to.name;
				doc.head = reprint_to.head;
				doc.time = time;
				doc.title = (doc.title.search(/[转载]/) > -1) ? title.title : "[转载]" + doc.title;
				doc.comments = [];
				doc.reprint_info = {'reprint_from': reprint_from};
				doc.pv = 0;

				// 更新被转载文章中原文档中reprint_info 内的 reprint_to
				collection.update({
					"name": reprint_from.name,
					"time.day": reprint_from.day,
					"title": reprint_from.title
				}, {
					$push: {
						"reprint_info.reprint_to": {
							"name": doc.name,
							"day": time.day,
							"title": doc.title
						}
					}
				}, function(err) {
					if(err) {
						mongodb.close();
						return callback(err);
					}
				})

				// 将转载生成的副本修改后存入数据库
				collection.insert(doc, {
					safe: true
				}, function(err, post) {
					mongodb.close();
					if(err) {
						return callback(err);
					}
					callback(err, post[0]);
				})
			})
		})
	})
}