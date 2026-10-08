from django.db import migrations, models


def vider_emails_vides(apps, schema_editor):
    # '' en double violerait l'unicité : un e-mail absent devient NULL.
    Utilisateur = apps.get_model('comptes', 'Utilisateur')
    Utilisateur.objects.filter(email='').update(email=None)


class Migration(migrations.Migration):

    dependencies = [
        ('comptes', '0002_alter_utilisateur_telephone'),
    ]

    operations = [
        migrations.AlterField(
            model_name='utilisateur',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True, verbose_name='adresse e-mail'),
        ),
        migrations.RunPython(vider_emails_vides, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='utilisateur',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True, unique=True, verbose_name='adresse e-mail'),
        ),
    ]
