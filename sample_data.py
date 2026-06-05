from db import *

add_user("Suzuki")
add_user("Tanaka")
add_user("Sato")
add_user("Yamada")

add_hobby(1, "Movie")
add_hobby(1, "Music")

add_hobby(2, "Movie")
add_hobby(3, "Movie")
add_hobby(4, "Reading")

add_free_time(1, "Mon", 3)
add_free_time(2, "Mon", 3)
add_free_time(3, "Mon", 3)
add_free_time(4, "Tue", 2)

print("Sample data inserted")